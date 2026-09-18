import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SyntheticVfsServer } from './test-server/synthetic-vfs-server.js';
import { VfsProviderAdapter } from '../src/vfs-provider-adapter.js';
import { VfsBrowserSessionManager } from '../src/runtime/vfs-browser-session-manager.js';
import { createVfsConfig } from '../src/config/vfs-adapter-config.js';
import type { VfsCredentialsProvider } from '../src/credentials/vfs-credentials-provider.js';
import type { ProviderContext, SlotCandidate, ProviderApplicantInput } from '@visaflow/provider-core';
import { BookingMode, ProviderCode } from '@visaflow/shared-types';

describe('VfsProviderAdapter Lifecycle (Synthetic Server)', { timeout: 20000 }, () => {
  let server: SyntheticVfsServer;
  let serverUrl: string;
  let sessionManager: VfsBrowserSessionManager;
  let adapter: VfsProviderAdapter;

  const mockCredentialsProvider: VfsCredentialsProvider = {
    async getCredentials(_accId: string) {
      return {
        email: 'test@example.com',
        password: 'ValidPassword123!',
      };
    },
  };

  beforeAll(async () => {
    server = new SyntheticVfsServer();
    serverUrl = await server.start();
  });

  afterEach(async () => {
    await sessionManager?.closeAll().catch(() => {});
  });

  afterAll(async () => {
    await sessionManager?.closeAll().catch(() => {});
    await server?.stop().catch(() => {});
  }, 30000);

  beforeEach(() => {
    server.setScenario('HAPPY_PATH');
    const config = createVfsConfig({
      headless: true,
      allowedOrigins: [serverUrl, 'http://127.0.0.1', 'https://visa.vfsglobal.com'],
    });
    sessionManager = new VfsBrowserSessionManager(config, 'worker-test-1');
    adapter = new VfsProviderAdapter(sessionManager, mockCredentialsProvider, config);
  });

  const createTestContext = (caseId: string, applicantCount = 1): ProviderContext => ({
    caseId,
    correlationId: `corr_${caseId}`,
    providerAccountId: 'acc_123',
    applicantCount,
    providerRoute: {
      id: 'route_1',
      providerCode: ProviderCode.VFS,
      sourceCountry: 'EG',
      destinationCountry: 'GR',
      applicationCentre: 'Cairo',
      visaCategory: 'Schengen Visa',
      visaSubcategory: 'Tourism',
      bookingMode: BookingMode.APPOINTMENT_CALENDAR,
      configuration: {
        entryUrl: `${serverUrl}/login`,
        availabilityMode: 'EARLIEST_SLOT',
        expectedProviderCode: 'VFS',
      },
    },
    casePreferences: {
      allowGroupSplit: false,
    },
  });

  it('authenticate: successfully logs in and returns authenticated status', async () => {
    const ctx = createTestContext('case_auth_1');
    const res = await adapter.authenticate(ctx);

    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.sessionId).toBe('case_auth_1');
      expect(res.data.authenticatedAt).toBeDefined();
    }
  });

  it('authenticate: returns HUMAN_ACTION_REQUIRED when CAPTCHA is detected', async () => {
    server.setScenario('CAPTCHA');
    const ctx = createTestContext('case_auth_captcha');
    const res = await adapter.authenticate(ctx);

    expect(res.kind).toBe('HUMAN_ACTION_REQUIRED');
    if (res.kind === 'HUMAN_ACTION_REQUIRED') {
      expect(res.action).toBe('CAPTCHA');
      expect(res.resumeToStatus).toBe('AUTHENTICATING');
    }
  });

  it('inspectRoute: selects centre, category, and subcategory', async () => {
    const ctx = createTestContext('case_inspect_1');
    await adapter.authenticate(ctx);

    const res = await adapter.inspectRoute(ctx);
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.routeSupported).toBe(true);
      expect(res.data.bookingMode).toBe(BookingMode.APPOINTMENT_CALENDAR);
    }
  });

  it('checkAvailability: returns SLOT_FOUND when capacity matches', async () => {
    const ctx = createTestContext('case_avail_1', 2);
    await adapter.authenticate(ctx);
    await adapter.inspectRoute(ctx);

    const res = await adapter.checkAvailability(ctx);
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.outcome).toBe('SLOT_FOUND');
      if (res.data.outcome === 'SLOT_FOUND') {
        expect(res.data.slot.date).toBe('2026-11-16');
      }
    }
  });

  it('checkAvailability: returns GROUP_CAPACITY_MISMATCH when applicants exceed 4', async () => {
    const ctx = createTestContext('case_avail_mismatch', 5);
    await adapter.authenticate(ctx);
    await adapter.inspectRoute(ctx);

    const res = await adapter.checkAvailability(ctx);
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.outcome).toBe('GROUP_CAPACITY_MISMATCH');
    }
  });

  it('checkAvailability: returns NO_SLOT when scenario is NO_SLOT', async () => {
    server.setScenario('NO_SLOT');
    const ctx = createTestContext('case_avail_noslot', 1);
    await adapter.authenticate(ctx);
    await adapter.inspectRoute(ctx);

    const res = await adapter.checkAvailability(ctx);
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.outcome).toBe('NO_SLOT');
    }
  });

  it('addApplicants: enters applicant form details in position order', async () => {
    const ctx = createTestContext('case_applicants_1', 1);
    await adapter.authenticate(ctx);
    await adapter.inspectRoute(ctx);

    const applicants: ProviderApplicantInput[] = [
      {
        position: 1,
        isPrimary: true,
        relation: 'PRIMARY',
        firstName: 'Ahmed',
        lastName: 'Hassan',
        gender: 'MALE',
        dateOfBirth: '1988-06-10',
        nationality: 'EGY',
        passportNumber: 'A99887766',
        passportExpiry: '2032-12-01',
        phone: '+201012345678',
        email: 'ahmed@test.com',
      },
    ];

    const res = await adapter.addApplicants(ctx, applicants);
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.submittedCount).toBe(1);
    }
  });

  it('selectAppointment: selects slot and advances', async () => {
    const ctx = createTestContext('case_select_1', 1);
    await adapter.authenticate(ctx);
    await adapter.inspectRoute(ctx);
    await adapter.addApplicants(ctx, [
      {
        position: 1,
        isPrimary: true,
        relation: 'PRIMARY',
        firstName: 'Ahmed',
        lastName: 'Hassan',
        gender: 'MALE',
        dateOfBirth: '1988-06-10',
        nationality: 'EGY',
        passportNumber: 'A99887766',
        passportExpiry: '2032-12-01',
      },
    ]);

    const slot: SlotCandidate = {
      date: '2026-11-16',
      time: '09:00',
      centre: 'Cairo',
      capacity: 2,
    };

    const res = await adapter.selectAppointment(ctx, slot);
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.selectedSlot.date).toBe('2026-11-16');
    }
  });

  it('getPaymentState: extracts payment required details without card entry', async () => {
    const ctx = createTestContext('case_payment_1', 1);
    await adapter.authenticate(ctx);
    await adapter.inspectRoute(ctx);
    await adapter.addApplicants(ctx, [
      {
        position: 1,
        isPrimary: true,
        relation: 'PRIMARY',
        firstName: 'Ahmed',
        lastName: 'Hassan',
        gender: 'MALE',
        dateOfBirth: '1988-06-10',
        nationality: 'EGY',
        passportNumber: 'A99887766',
        passportExpiry: '2032-12-01',
      },
    ]);

    const slot: SlotCandidate = {
      date: '2026-11-16',
      time: '09:00',
    };
    await adapter.selectAppointment(ctx, slot);

    const res = await adapter.getPaymentState(ctx);
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.paymentState).toBe('REQUIRED');
      expect(res.data.currency).toBe('EUR');
    }
  });

  it('getConfirmation: extracts booking reference upon payment completion', async () => {
    server.paymentCompleted = true;
    const ctx = createTestContext('case_confirm_1', 1);
    await adapter.authenticate(ctx);
    await adapter.inspectRoute(ctx);
    await adapter.addApplicants(ctx, [
      {
        position: 1,
        isPrimary: true,
        relation: 'PRIMARY',
        firstName: 'Ahmed',
        lastName: 'Hassan',
        gender: 'MALE',
        dateOfBirth: '1988-06-10',
        nationality: 'EGY',
        passportNumber: 'A99887766',
        passportExpiry: '2032-12-01',
      },
    ]);

    const slot: SlotCandidate = {
      date: '2026-11-16',
      time: '09:00',
    };
    await adapter.selectAppointment(ctx, slot);

    const res = await adapter.getConfirmation(ctx);
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.referenceNumber).toBe('GR-ATH-2026-88392');
      expect(res.data.confirmedAt).toBeDefined();
    }
  });
});

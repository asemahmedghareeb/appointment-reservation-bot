import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SyntheticVfsServer } from './test-server/synthetic-vfs-server.js';
import { VfsProviderAdapter } from '../src/vfs-provider-adapter.js';
import { VfsBrowserSessionManager } from '../src/runtime/vfs-browser-session-manager.js';
import { createVfsConfig } from '../src/config/vfs-adapter-config.js';
import { parseVfsRouteProfile } from '../src/config/vfs-route-profile.parser.js';
import { VfsCapabilityResolver } from '../src/capabilities/vfs-capability.resolver.js';
import { VfsPageProfileResolver } from '../src/profiles/vfs-page-profile.resolver.js';
import { VfsRouteNotSupportedError } from '../src/errors/vfs-route-not-supported.error.js';
import type { VfsCredentialsProvider } from '../src/credentials/vfs-credentials-provider.js';
import type { ProviderApplicantInput, ProviderContext, SlotCandidate } from '@visaflow/provider-core';
import { BookingMode, ProviderCode } from '@visaflow/shared-types';

describe('VFS Multi-Country Expansion (Phase 3.1 Matrix)', { timeout: 35000 }, () => {
  let server: SyntheticVfsServer;
  let serverUrl: string;
  let sessionManager: VfsBrowserSessionManager;
  let adapter: VfsProviderAdapter;

  const capabilityResolver = new VfsCapabilityResolver();
  const pageProfileResolver = new VfsPageProfileResolver();

  const mockCredentialsProvider: VfsCredentialsProvider = {
    async getCredentials(_accId: string) {
      return {
        email: 'multicountry@example.com',
        password: 'ValidPassword123!',
      };
    },
  };

  beforeAll(async () => {
    server = new SyntheticVfsServer();
    serverUrl = await server.start();
  });

  afterAll(async () => {
    await sessionManager?.closeAll().catch(() => {});
    await server?.stop().catch(() => {});
  });

  beforeEach(() => {
    server.setScenario('HAPPY_PATH');
    const config = createVfsConfig({
      headless: true,
      allowedOrigins: [serverUrl, 'http://127.0.0.1', 'https://visa.vfsglobal.com'],
    });
    sessionManager = new VfsBrowserSessionManager(config, 'worker-multi-test');
    adapter = new VfsProviderAdapter(sessionManager, mockCredentialsProvider, config);
  });

  const DESTINATIONS = [
    {
      country: 'GR',
      centre: 'Cairo',
      category: 'Schengen Visa',
      subcategory: 'Tourism',
      availabilityMode: 'EARLIEST_SLOT' as const,
      pageProfile: 'VFS_STANDARD_V1',
      applicantLimit: 4,
      groupBooking: true,
    },
    {
      country: 'HU',
      centre: 'Alexandria',
      category: 'National Visa',
      subcategory: 'Study',
      availabilityMode: 'CALENDAR' as const,
      pageProfile: 'VFS_CALENDAR_V1',
      applicantLimit: 2,
      groupBooking: true,
    },
    {
      country: 'PT',
      centre: 'Cairo',
      category: 'Short Stay',
      subcategory: 'Business',
      availabilityMode: 'EARLIEST_SLOT' as const,
      pageProfile: 'VFS_EARLIEST_SLOT_V1',
      applicantLimit: 5,
      groupBooking: true,
    },
    {
      country: 'AT',
      centre: 'Giza',
      category: 'Tourist Visa',
      subcategory: 'Individual',
      availabilityMode: 'CALENDAR' as const,
      pageProfile: 'VFS_CALENDAR_V1',
      applicantLimit: 3,
      groupBooking: false,
    },
  ];

  function createDestinationContext(
    caseId: string,
    destConfig: (typeof DESTINATIONS)[number],
    applicantCount = 1,
  ): ProviderContext {
    return {
      caseId,
      correlationId: `corr_${caseId}`,
      providerAccountId: `acc_${destConfig.country.toLowerCase()}`,
      applicantCount,
      providerRoute: {
        id: `route_eg_${destConfig.country.toLowerCase()}`,
        providerCode: ProviderCode.VFS,
        sourceCountry: 'EG',
        destinationCountry: destConfig.country,
        applicationCentre: destConfig.centre,
        visaCategory: destConfig.category,
        visaSubcategory: destConfig.subcategory,
        bookingMode:
          destConfig.availabilityMode === 'CALENDAR'
            ? BookingMode.APPOINTMENT_CALENDAR
            : BookingMode.EARLIEST_APPOINTMENT,
        configuration: {
          entryUrl: `${serverUrl}/login?dest=${destConfig.country}`,
          availabilityMode: destConfig.availabilityMode,
          pageProfile: destConfig.pageProfile,
          expectedProviderCode: 'VFS',
          capabilities: {
            groupBooking: destConfig.groupBooking,
            applicantLimit: destConfig.applicantLimit,
            paymentRequired: true,
          },
        },
      },
      casePreferences: {
        allowGroupSplit: false,
      },
    };
  }

  // ==========================================
  // 1. Required Route Test Matrix for GR, HU, PT, AT
  // ==========================================
  for (const dest of DESTINATIONS) {
    describe(`Destination: EG → ${dest.country}`, () => {
      it(`parses VfsRouteProfile correctly for ${dest.country}`, () => {
        const ctx = createDestinationContext(`case_parse_${dest.country}`, dest);
        const profile = parseVfsRouteProfile(ctx.providerRoute.configuration, {
          sourceCountry: ctx.providerRoute.sourceCountry,
          destinationCountry: ctx.providerRoute.destinationCountry,
        });

        expect(profile.sourceCountry).toBe('EG');
        expect(profile.destinationCountry).toBe(dest.country);
        expect(profile.entryUrl).toBe(`${serverUrl}/login?dest=${dest.country}`);
        expect(profile.availabilityMode).toBe(dest.availabilityMode);
        expect(profile.pageProfile).toBe(dest.pageProfile);
        expect(profile.capabilities?.applicantLimit).toBe(dest.applicantLimit);
        expect(profile.capabilities?.groupBooking).toBe(dest.groupBooking);
      });

      it(`resolves page profile and capabilities for ${dest.country}`, () => {
        const ctx = createDestinationContext(`case_caps_${dest.country}`, dest);
        const profile = parseVfsRouteProfile(ctx.providerRoute.configuration, {
          sourceCountry: ctx.providerRoute.sourceCountry,
          destinationCountry: ctx.providerRoute.destinationCountry,
        });

        const pageDef = pageProfileResolver.resolve(profile);
        expect(pageDef.profileId).toBe(dest.pageProfile);

        const caps = capabilityResolver.resolve(profile);
        expect(caps.availabilityMode).toBe(dest.availabilityMode);
        expect(caps.pageProfile).toBe(dest.pageProfile);
        expect(caps.maxApplicants).toBe(dest.applicantLimit);
        expect(caps.supportsGroupBooking).toBe(dest.groupBooking);
      });

      it(`executes auth, route inspection, and availability for ${dest.country}`, async () => {
        const ctx = createDestinationContext(`case_flow_${dest.country}`, dest, 1);

        // 1. Authenticate
        const authRes = await adapter.authenticate(ctx);
        expect(authRes.kind).toBe('SUCCESS');

        // 2. Inspect route
        const inspectRes = await adapter.inspectRoute(ctx);
        expect(inspectRes.kind).toBe('SUCCESS');
        if (inspectRes.kind === 'SUCCESS') {
          expect(inspectRes.data.routeSupported).toBe(true);
          expect(inspectRes.data.metadata?.resolvedCentre).toBe(dest.centre);
        }

        // 3. Check availability
        const availRes = await adapter.checkAvailability(ctx);
        expect(availRes.kind).toBe('SUCCESS');
        if (availRes.kind === 'SUCCESS') {
          expect(availRes.data.outcome).toBe('SLOT_FOUND');
        }
      });

      it(`enforces group capability limit for ${dest.country}`, async () => {
        // Exceed applicantLimit
        const exceedingCount = dest.applicantLimit + 1;
        const ctx = createDestinationContext(`case_grp_${dest.country}`, dest, exceedingCount);

        await adapter.authenticate(ctx);
        await adapter.inspectRoute(ctx);

        const availRes = await adapter.checkAvailability(ctx);
        expect(availRes.kind).toBe('SUCCESS');
        if (availRes.kind === 'SUCCESS') {
          expect(availRes.data.outcome).toBe('GROUP_CAPACITY_MISMATCH');
        }
      });
    });
  }

  // ==========================================
  // 2. Multi-Country Isolation Test
  // ==========================================
  it('Multi-Country Isolation: GR, HU, PT, AT configs never leak across cases', async () => {
    const caseGr = createDestinationContext('case_iso_gr', DESTINATIONS[0]!);
    const caseHu = createDestinationContext('case_iso_hu', DESTINATIONS[1]!);
    const casePt = createDestinationContext('case_iso_pt', DESTINATIONS[2]!);
    const caseAt = createDestinationContext('case_iso_at', DESTINATIONS[3]!);

    // Authenticate and inspect each case sequentially
    const resGr = await adapter.authenticate(caseGr);
    expect(resGr.kind).toBe('SUCCESS');
    const inspGr = await adapter.inspectRoute(caseGr);
    expect(inspGr.kind).toBe('SUCCESS');

    const resHu = await adapter.authenticate(caseHu);
    expect(resHu.kind).toBe('SUCCESS');
    const inspHu = await adapter.inspectRoute(caseHu);
    expect(inspHu.kind).toBe('SUCCESS');

    const resPt = await adapter.authenticate(casePt);
    expect(resPt.kind).toBe('SUCCESS');
    const inspPt = await adapter.inspectRoute(casePt);
    expect(inspPt.kind).toBe('SUCCESS');

    const resAt = await adapter.authenticate(caseAt);
    expect(resAt.kind).toBe('SUCCESS');
    const inspAt = await adapter.inspectRoute(caseAt);
    expect(inspAt.kind).toBe('SUCCESS');

    // Verify metadata was strictly isolated
    if (inspGr.kind === 'SUCCESS') expect(inspGr.data.metadata?.resolvedCentre).toBe('Cairo');
    if (inspHu.kind === 'SUCCESS') expect(inspHu.data.metadata?.resolvedCentre).toBe('Alexandria');
    if (inspPt.kind === 'SUCCESS') expect(inspPt.data.metadata?.resolvedCentre).toBe('Cairo');
    if (inspAt.kind === 'SUCCESS') expect(inspAt.data.metadata?.resolvedCentre).toBe('Giza');

    // Parse each profile independently to verify immutability
    const pGr = parseVfsRouteProfile(caseGr.providerRoute.configuration, {
      sourceCountry: 'EG',
      destinationCountry: 'GR',
    });
    const pHu = parseVfsRouteProfile(caseHu.providerRoute.configuration, {
      sourceCountry: 'EG',
      destinationCountry: 'HU',
    });
    const pPt = parseVfsRouteProfile(casePt.providerRoute.configuration, {
      sourceCountry: 'EG',
      destinationCountry: 'PT',
    });
    const pAt = parseVfsRouteProfile(caseAt.providerRoute.configuration, {
      sourceCountry: 'EG',
      destinationCountry: 'AT',
    });

    expect(pGr.destinationCountry).toBe('GR');
    expect(pHu.destinationCountry).toBe('HU');
    expect(pPt.destinationCountry).toBe('PT');
    expect(pAt.destinationCountry).toBe('AT');

    expect(pGr.pageProfile).toBe('VFS_STANDARD_V1');
    expect(pHu.pageProfile).toBe('VFS_CALENDAR_V1');
    expect(pPt.pageProfile).toBe('VFS_EARLIEST_SLOT_V1');
    expect(pAt.pageProfile).toBe('VFS_CALENDAR_V1');
  });

  // ==========================================
  // 3. Origin Security Validation Test
  // ==========================================
  it('rejects unapproved route entry URLs', async () => {
    const invalidOriginCtx = createDestinationContext('case_unapproved_url', DESTINATIONS[0]!);
    invalidOriginCtx.providerRoute.configuration = {
      entryUrl: 'https://malicious-phishing-vfs.example.com/login',
      availabilityMode: 'EARLIEST_SLOT',
    };

    const res = await adapter.authenticate(invalidOriginCtx);
    expect(res.kind).toBe('PERMANENT_FAILURE');
    if (res.kind === 'PERMANENT_FAILURE') {
      expect(res.code).toBe('VFS_ORIGIN_NOT_ALLOWED');
    }
  });

  // ==========================================
  // 4. Unsupported Route Test
  // ==========================================
  it('Unsupported Route: throws VfsRouteNotSupportedError and does NOT fall back to Greece', () => {
    expect(() => {
      parseVfsRouteProfile({
        entryUrl: 'https://visa.vfsglobal.com',
        // destinationCountry missing
      });
    }).toThrow(VfsRouteNotSupportedError);

    expect(() => {
      parseVfsRouteProfile(null);
    }).toThrow(VfsRouteNotSupportedError);
  });

  // ==========================================
  // 5. Full Synthetic Booking Lifecycle
  // ==========================================
  it('Full Synthetic Booking Lifecycle across destinations', async () => {
    // Run full lifecycle for Portugal route
    const ctx = createDestinationContext('case_lifecycle_pt', DESTINATIONS[2]!);

    // 1. Authenticate
    const authRes = await adapter.authenticate(ctx);
    expect(authRes.kind).toBe('SUCCESS');

    // 2. Inspect Route
    const inspectRes = await adapter.inspectRoute(ctx);
    expect(inspectRes.kind).toBe('SUCCESS');

    // 3. Check Availability
    const availRes = await adapter.checkAvailability(ctx);
    expect(availRes.kind).toBe('SUCCESS');
    let slot: SlotCandidate | undefined;
    if (availRes.kind === 'SUCCESS' && availRes.data.outcome === 'SLOT_FOUND') {
      slot = availRes.data.slot;
      expect(slot.date).toBeDefined();
    }
    expect(slot).toBeDefined();

    // 4. Begin Booking
    const beginRes = await adapter.beginBooking(ctx, slot!);
    expect(beginRes.kind).toBe('SUCCESS');

    // 5. Add Applicants
    const applicants: ProviderApplicantInput[] = [
      {
        id: 'app_pt_1',
        position: 1,
        isPrimary: true,
        firstName: 'Carlos',
        lastName: 'Silva',
        gender: 'MALE' as any,
        dateOfBirth: '1990-01-01',
        nationality: 'EG',
        passportNumber: 'A99887766',
        passportExpiry: '2030-01-01',
      },
    ];
    const addRes = await adapter.addApplicants(ctx, applicants);
    expect(addRes.kind).toBe('SUCCESS');

    // 6. Select Appointment
    const selectRes = await adapter.selectAppointment(ctx, slot!);
    expect(selectRes.kind).toBe('SUCCESS');

    // 7. Get Payment State
    const payRes = await adapter.getPaymentState(ctx);
    expect(payRes.kind).toBe('SUCCESS');
    if (payRes.kind === 'SUCCESS') {
      expect(payRes.data.paymentState).toBe('REQUIRED');
    }

    // 8. Human completes payment
    server.paymentCompleted = true;
    await adapter.getPaymentState(ctx);
    const confirmRes = await adapter.getConfirmation(ctx);
    expect(confirmRes.kind).toBe('SUCCESS');
    if (confirmRes.kind === 'SUCCESS') {
      expect(confirmRes.data.referenceNumber).toBeDefined();
    }
  });
});

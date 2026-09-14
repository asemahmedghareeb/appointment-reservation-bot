import { describe, it, expect, beforeEach } from 'vitest';
import { BookingCaseStatus, BookingMode, ProviderCode, Gender, ApplicantRelation } from '@visaflow/shared-types';
import {
  MockProviderAdapter,
  MockScenario,
  HumanActionType,
  type ProviderContext,
  type ProviderApplicantInput,
  type SlotCandidate,
} from '../src/index.js';

describe('MockProviderAdapter', () => {
  let adapter: MockProviderAdapter;

  const mockContext: ProviderContext = {
    caseId: 'case_test_123',
    correlationId: 'corr_test_123',
    providerRoute: {
      id: 'route_1',
      providerCode: ProviderCode.VFS,
      sourceCountry: 'EG',
      destinationCountry: 'FR',
      applicationCentre: 'Cairo',
      visaCategory: 'TOURISM',
      visaSubcategory: 'SHORT_STAY',
      bookingMode: BookingMode.APPOINTMENT_CALENDAR,
      configuration: {},
    },
    casePreferences: {
      preferredDateFrom: '2026-11-10',
      preferredDateTo: '2026-11-20',
      allowGroupSplit: false,
    },
    applicantCount: 2,
  };

  const mockApplicants: ProviderApplicantInput[] = [
    {
      id: 'app_1',
      position: 1,
      relation: ApplicantRelation.PRIMARY,
      isPrimary: true,
      firstName: 'Tarek',
      lastName: 'Omar',
      gender: Gender.MALE,
      dateOfBirth: '1995-01-01',
      nationality: 'EG',
      passportNumber: 'A1234567',
      passportExpiry: '2030-01-01',
    },
    {
      id: 'app_2',
      position: 2,
      relation: ApplicantRelation.SPOUSE,
      isPrimary: false,
      firstName: 'Sara',
      lastName: 'Omar',
      gender: Gender.FEMALE,
      dateOfBirth: '1997-05-05',
      nationality: 'EG',
      passportNumber: 'A7654321',
      passportExpiry: '2031-01-01',
    },
  ];

  beforeEach(() => {
    adapter = new MockProviderAdapter();
  });

  it('NO_SLOT scenario returns typed NO_SLOT availability', async () => {
    adapter.setScenario(mockContext.caseId, MockScenario.NO_SLOT);

    const auth = await adapter.authenticate(mockContext);
    expect(auth.kind).toBe('SUCCESS');

    const avail = await adapter.checkAvailability(mockContext);
    expect(avail.kind).toBe('SUCCESS');
    if (avail.kind === 'SUCCESS') {
      expect(avail.data.outcome).toBe('NO_SLOT');
    }
  });

  it('SLOT_FOUND scenario returns deterministic slot candidate', async () => {
    adapter.setScenario(mockContext.caseId, MockScenario.SLOT_FOUND);

    const avail = await adapter.checkAvailability(mockContext);
    expect(avail.kind).toBe('SUCCESS');
    if (avail.kind === 'SUCCESS') {
      expect(avail.data.outcome).toBe('SLOT_FOUND');
      if (avail.data.outcome === 'SLOT_FOUND') {
        expect(avail.data.slot.date).toBe('2026-11-10');
        expect(avail.data.slot.centre).toBe('Cairo');
        expect(avail.data.slot.capacity).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('GROUP_CAPACITY_MISMATCH scenario returns capacity details without slot', async () => {
    adapter.setScenario(mockContext.caseId, MockScenario.GROUP_CAPACITY_MISMATCH);

    const avail = await adapter.checkAvailability(mockContext);
    expect(avail.kind).toBe('SUCCESS');
    if (avail.kind === 'SUCCESS') {
      expect(avail.data.outcome).toBe('GROUP_CAPACITY_MISMATCH');
      if (avail.data.outcome === 'GROUP_CAPACITY_MISMATCH') {
        expect(avail.data.requestedApplicants).toBe(2);
        expect(avail.data.maximumAvailableApplicants).toBe(1);
      }
    }
  });

  it('CAPTCHA_REQUIRED scenario demands human action then resumes cleanly', async () => {
    adapter.setScenario(mockContext.caseId, MockScenario.CAPTCHA_REQUIRED);

    // Initial authentication demands captcha
    const auth1 = await adapter.authenticate(mockContext);
    expect(auth1.kind).toBe('HUMAN_ACTION_REQUIRED');
    if (auth1.kind === 'HUMAN_ACTION_REQUIRED') {
      expect(auth1.action).toBe(HumanActionType.CAPTCHA);
      expect(auth1.resumeToStatus).toBe(BookingCaseStatus.AUTHENTICATING);
    }

    // Explicit resume
    const resumeRes = await adapter.resume(mockContext);
    expect(resumeRes.kind).toBe('SUCCESS');

    // Subsequent authentication succeeds
    const auth2 = await adapter.authenticate(mockContext);
    expect(auth2.kind).toBe('SUCCESS');
  });

  it('OTP_REQUIRED scenario triggers OTP request on payment inspection then resumes', async () => {
    adapter.setScenario(mockContext.caseId, MockScenario.OTP_REQUIRED);

    const pay1 = await adapter.getPaymentState(mockContext);
    expect(pay1.kind).toBe('HUMAN_ACTION_REQUIRED');
    if (pay1.kind === 'HUMAN_ACTION_REQUIRED') {
      expect(pay1.action).toBe(HumanActionType.OTP);
      expect(pay1.resumeToStatus).toBe(BookingCaseStatus.PAYMENT_REQUIRED);
    }

    await adapter.resume(mockContext);

    const pay2 = await adapter.getPaymentState(mockContext);
    expect(pay2.kind).toBe('SUCCESS');
  });

  it('SLOT_LOST_DURING_BOOKING scenario returns typed SLOT_LOST outcome', async () => {
    adapter.setScenario(mockContext.caseId, MockScenario.SLOT_LOST_DURING_BOOKING);

    const slot: SlotCandidate = { date: '2026-11-10', externalSlotId: 'SLOT_1' };
    const bookRes = await adapter.beginBooking(mockContext, slot);

    expect(bookRes.kind).toBe('SUCCESS');
    if (bookRes.kind === 'SUCCESS') {
      expect(bookRes.data.outcome).toBe('SLOT_LOST');
    }
  });

  it('PAYMENT_REQUIRED scenario stops with payment url and required status', async () => {
    adapter.setScenario(mockContext.caseId, MockScenario.PAYMENT_REQUIRED);

    const pay = await adapter.getPaymentState(mockContext);
    expect(pay.kind).toBe('SUCCESS');
    if (pay.kind === 'SUCCESS') {
      expect(pay.data.paymentState).toBe('REQUIRED');
      expect(pay.data.paymentUrl).toBeDefined();
    }
  });

  it('CONFIRMED scenario drives complete deterministic lifecycle', async () => {
    adapter.setScenario(mockContext.caseId, MockScenario.CONFIRMED);

    const auth = await adapter.authenticate(mockContext);
    expect(auth.kind).toBe('SUCCESS');

    const route = await adapter.inspectRoute(mockContext);
    expect(route.kind).toBe('SUCCESS');

    const avail = await adapter.checkAvailability(mockContext);
    expect(avail.kind).toBe('SUCCESS');
    if (avail.kind !== 'SUCCESS' || avail.data.outcome !== 'SLOT_FOUND') {
      throw new Error('Expected slot found');
    }

    const slot = avail.data.slot;
    const booking = await adapter.beginBooking(mockContext, slot);
    expect(booking.kind).toBe('SUCCESS');

    const applicants = await adapter.addApplicants(mockContext, mockApplicants);
    expect(applicants.kind).toBe('SUCCESS');

    const selection = await adapter.selectAppointment(mockContext, slot);
    expect(selection.kind).toBe('SUCCESS');

    const payment = await adapter.getPaymentState(mockContext);
    expect(payment.kind).toBe('SUCCESS');

    const confirmation = await adapter.getConfirmation(mockContext);
    expect(confirmation.kind).toBe('SUCCESS');
    if (confirmation.kind === 'SUCCESS') {
      expect(confirmation.data.referenceNumber).toContain('VF-CONF-');
      expect(confirmation.data.appointmentDate).toBe('2026-11-10');
    }
  });

  it('guarantees deterministic execution across repeated runs', async () => {
    const adapter1 = new MockProviderAdapter();
    const adapter2 = new MockProviderAdapter();

    adapter1.setScenario(mockContext.caseId, MockScenario.CONFIRMED);
    adapter2.setScenario(mockContext.caseId, MockScenario.CONFIRMED);

    const avail1 = await adapter1.checkAvailability(mockContext);
    const avail2 = await adapter2.checkAvailability(mockContext);

    expect(avail1).toEqual(avail2);
  });
});

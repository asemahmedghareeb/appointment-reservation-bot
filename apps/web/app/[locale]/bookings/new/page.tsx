'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from '../../../../i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { TechnicalText } from '../../../../components/ui/technical-text';
import { getLocalizedErrorMessage } from '../../../../lib/formatters/errors';
import { formatNumber } from '../../../../lib/formatters/numbers';
import type { BookingOptionalService } from '@visaflow/shared-types';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Calendar,
  User,
  Users,
  MapPin,
  Clock,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Database,
  UserCheck,
  RotateCcw,
  Lock,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Info,
  CheckCircle2,
  X,
} from 'lucide-react';

interface WizardApplicant {
  id?: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  isPrimary: boolean;
}

const DEFAULT_APPLICANT: WizardApplicant = {
  firstName: '',
  lastName: '',
  gender: 'MALE',
  dateOfBirth: '1995-05-15',
  nationality: 'EG',
  passportNumber: '',
  passportExpiry: '2030-01-01',
  phoneCountryCode: '+20',
  phoneNumber: '',
  email: '',
  isPrimary: true,
};

const INITIAL_OPTIONAL_SERVICES: BookingOptionalService[] = [
  {
    providerServiceCode: 'PREMIUM_LOUNGE',
    name: 'Premium Lounge',
    description: 'Dedicated lounge access, personalized assistance, and complimentary refreshments at the application centre.',
    price: 1950,
    currency: 'EGP',
    selected: false,
  },
  {
    providerServiceCode: 'FORM_FILLING',
    name: 'Application Form Filling',
    description: 'Professional assistance by VFS staff in completing and printing visa application forms.',
    price: 350,
    currency: 'EGP',
    selected: false,
  },
  {
    providerServiceCode: 'DOCUMENT_PRINTING',
    name: 'Document Printing',
    description: 'Printing service for supporting documents and passport copies at the centre.',
    price: 50,
    currency: 'EGP',
    selected: false,
  },
];

export default function LocalizedNewBookingWizardPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('bookingWizard');
  const tCommon = useTranslations('common');
  const tCountries = useTranslations('countries');

  const getCountryName = (code: string) => {
    try {
      return tCountries(code);
    } catch {
      return code;
    }
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // STEP 1: Route State
  const [providerCode, setProviderCode] = useState<string>('VFS');
  const [sourceCountry, setSourceCountry] = useState<string>('EG');
  const [destinationCountry, setDestinationCountry] = useState<string>('');
  const [applicationCentre, setApplicationCentre] = useState<string>('');
  const [visaCategory, setVisaCategory] = useState<string>('');
  const [visaSubcategory, setVisaSubcategory] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');

  // STEP 2: Multi-Applicants State
  const [applicants, setApplicants] = useState<WizardApplicant[]>([]);
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [editingApplicantIndex, setEditingApplicantIndex] = useState<number | null>(null);
  const [activeApplicant, setActiveApplicant] = useState<WizardApplicant>({ ...DEFAULT_APPLICANT });
  const [applicantFormErrors, setApplicantFormErrors] = useState<Record<string, string>>({});
  const [selectedExistingApplicantId, setSelectedExistingApplicantId] = useState<string | null>(null);

  // STEP 3: Appointment Preferences State
  const [appointmentSelectionMode, setAppointmentSelectionMode] = useState<
    'ANY_AVAILABLE' | 'DATE_RANGE' | 'EXACT_DATE' | 'EXACT_DATE_AND_TIME'
  >('ANY_AVAILABLE');
  const [preferredDateFrom, setPreferredDateFrom] = useState<string>(
    new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0] ?? ''
  );
  const [preferredDateTo, setPreferredDateTo] = useState<string>(
    new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0] ?? ''
  );
  const [preferredDate, setPreferredDate] = useState<string>(
    new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0] ?? ''
  );
  const [preferredTimeFrom, setPreferredTimeFrom] = useState<string>('09:00');
  const [preferredTimeTo, setPreferredTimeTo] = useState<string>('12:00');
  const [acceptAnyAvailableTime, setAcceptAnyAvailableTime] = useState<boolean>(true);
  const [appointmentType, setAppointmentType] = useState<string>('STANDARD');
  const [allowGroupSplit, setAllowGroupSplit] = useState<boolean>(false);

  // Bot active window presets
  const [scheduleMode, setScheduleMode] = useState<'24_7' | 'CUSTOM_HOURS'>('24_7');
  const [windowStart, setWindowStart] = useState<string>('09:00');
  const [windowEnd, setWindowEnd] = useState<string>('17:00');
  const [startType, setStartType] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(
    new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  );
  const [durationMode, setDurationMode] = useState<'UNTIL_FOUND' | 'CUSTOM_DURATION'>('UNTIL_FOUND');
  const [durationHours, setDurationHours] = useState<number>(4);
  const [pollingRate, setPollingRate] = useState<'SAFE' | 'FAST' | 'RELAXED'>('SAFE');

  // STEP 4: Optional Services State (DEFAULT: NONE SELECTED)
  const [services, setServices] = useState<BookingOptionalService[]>(INITIAL_OPTIONAL_SERVICES);

  // STEP 5: Terms & Marketing Consent State
  const [providerTermsAccepted, setProviderTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Computed bot execution string
  const computedPreferredTimeString = useMemo(() => {
    const parts: string[] = [];
    if (scheduleMode === '24_7') {
      parts.push(locale === 'ar' ? 'طوال اليوم (24/7)' : '24/7 Continuous');
    } else {
      parts.push(locale === 'ar' ? `ساعات العمل: من ${windowStart} إلى ${windowEnd}` : `Hours: ${windowStart} to ${windowEnd}`);
    }

    if (startType === 'SCHEDULED') {
      parts.push(locale === 'ar' ? `بدء مجدول: ${scheduledDateTime.replace('T', ' ')}` : `Starts: ${scheduledDateTime.replace('T', ' ')}`);
    } else {
      parts.push(locale === 'ar' ? 'بدء فوري' : 'Immediate Start');
    }

    if (durationMode === 'CUSTOM_DURATION') {
      parts.push(locale === 'ar' ? `المدة: ${durationHours} ساعة` : `Duration: ${durationHours}h`);
    } else {
      parts.push(locale === 'ar' ? 'مستمر حتى الحجز' : 'Until booked');
    }

    if (pollingRate === 'FAST') {
      parts.push(locale === 'ar' ? 'فحص سريع (1 دقيقة)' : 'Fast (1m)');
    } else if (pollingRate === 'RELAXED') {
      parts.push(locale === 'ar' ? 'فحص هادئ (10 دقائق)' : 'Relaxed (10m)');
    } else {
      parts.push(locale === 'ar' ? 'فحص آمن (3 دقائق)' : 'Safe (3m)');
    }

    return parts.join(' • ');
  }, [scheduleMode, windowStart, windowEnd, startType, scheduledDateTime, durationMode, durationHours, pollingRate, locale]);

  // Query Enabled Routes
  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['provider-routes', providerCode, sourceCountry],
    queryFn: async () => {
      const list = await api.providerRoutes.list({
        provider: providerCode,
        sourceCountry,
        enabled: true,
      });
      return list || [];
    },
  });

  // Query Existing Applicants for Database Auto-Fill
  const { data: existingApplicantsData } = useQuery({
    queryKey: ['existing-applicants-list'],
    queryFn: () => api.applicants.list({ limit: 100 }),
  });
  const existingApplicants = existingApplicantsData?.items || [];

  // Cascading Route Options
  const availableDestinations = useMemo(() => {
    if (!routes) return [];
    return Array.from(new Set(routes.map((r: any) => r.destinationCountry))).filter(Boolean) as string[];
  }, [routes]);

  const availableCentres = useMemo(() => {
    if (!routes || !destinationCountry) return [];
    return Array.from(
      new Set(
        routes
          .filter((r: any) => r.destinationCountry === destinationCountry)
          .map((r: any) => r.applicationCentre)
      )
    ).filter(Boolean) as string[];
  }, [routes, destinationCountry]);

  const availableCategories = useMemo(() => {
    if (!routes || !destinationCountry || !applicationCentre) return [];
    return Array.from(
      new Set(
        routes
          .filter(
            (r: any) =>
              r.destinationCountry === destinationCountry &&
              r.applicationCentre === applicationCentre
          )
          .map((r: any) => r.visaCategory)
      )
    ).filter(Boolean) as string[];
  }, [routes, destinationCountry, applicationCentre]);

  const availableSubcategories = useMemo(() => {
    if (!routes || !destinationCountry || !applicationCentre || !visaCategory) return [];
    return Array.from(
      new Set(
        routes
          .filter(
            (r: any) =>
              r.destinationCountry === destinationCountry &&
              r.applicationCentre === applicationCentre &&
              r.visaCategory === visaCategory
          )
          .map((r: any) => r.visaSubcategory)
      )
    ).filter(Boolean) as string[];
  }, [routes, destinationCountry, applicationCentre, visaCategory]);

  const selectedRouteObj = useMemo(() => {
    return routes?.find((r: any) => r.id === selectedRouteId) || null;
  }, [routes, selectedRouteId]);

  const handleDestinationChange = (newDest: string) => {
    setDestinationCountry(newDest);
    setApplicationCentre('');
    setVisaCategory('');
    setVisaSubcategory('');
    setSelectedRouteId('');
  };

  const handleCentreChange = (newCentre: string) => {
    setApplicationCentre(newCentre);
    setVisaCategory('');
    setVisaSubcategory('');
    setSelectedRouteId('');
  };

  const handleCategoryChange = (newCat: string) => {
    setVisaCategory(newCat);
    setVisaSubcategory('');
    setSelectedRouteId('');
  };

  const handleSubcategoryChange = (newSub: string) => {
    setVisaSubcategory(newSub);
    const matched = routes?.find(
      (r: any) =>
        r.destinationCountry === destinationCountry &&
        r.applicationCentre === applicationCentre &&
        r.visaCategory === visaCategory &&
        r.visaSubcategory === newSub
    );
    if (matched) {
      setSelectedRouteId(matched.id);
    }
  };

  // Applicant Modal & Form Handlers
  const handleOpenAddApplicant = () => {
    setEditingApplicantIndex(null);
    setSelectedExistingApplicantId(null);
    setActiveApplicant({
      ...DEFAULT_APPLICANT,
      isPrimary: applicants.length === 0,
    });
    setApplicantFormErrors({});
    setShowApplicantModal(true);
  };

  const handleOpenEditApplicant = (idx: number) => {
    setEditingApplicantIndex(idx);
    setSelectedExistingApplicantId(applicants[idx]?.id || null);
    setActiveApplicant({ ...applicants[idx]! });
    setApplicantFormErrors({});
    setShowApplicantModal(true);
  };

  const checkApplicantCompleteness = (app: WizardApplicant, index: number): string | null => {
    if (!app.firstName?.trim()) {
      return locale === 'ar' ? `المتقدم #${index + 1}: الاسم الأول مطلوب` : `Applicant #${index + 1}: First name is required`;
    }
    if (!app.lastName?.trim()) {
      return locale === 'ar' ? `المتقدم #${index + 1}: اسم العائلة مطلوب` : `Applicant #${index + 1}: Last name is required`;
    }
    if (!app.id && (!app.passportNumber?.trim() || app.passportNumber.includes('*'))) {
      return locale === 'ar' ? `المتقدم #${index + 1}: رقم جواز السفر مطلوب بشكل كامل وصحيح` : `Applicant #${index + 1}: Valid passport number is required`;
    }
    if (!app.nationality?.trim()) {
      return locale === 'ar' ? `المتقدم #${index + 1}: الجنسية مطلوبة` : `Applicant #${index + 1}: Nationality is required`;
    }
    if (!app.dateOfBirth) {
      return locale === 'ar' ? `المتقدم #${index + 1}: تاريخ الميلاد مطلوب` : `Applicant #${index + 1}: Date of birth is required`;
    }
    if (!app.passportExpiry) {
      return locale === 'ar' ? `المتقدم #${index + 1}: تاريخ انتهاء الجواز مطلوب` : `Applicant #${index + 1}: Passport expiry date is required`;
    }
    if (!app.id && !app.phoneNumber?.trim()) {
      return locale === 'ar' ? `المتقدم #${index + 1}: رقم الهاتف مطلوب` : `Applicant #${index + 1}: Phone number is required`;
    }
    return null;
  };

  const handleRemoveApplicant = (idx: number) => {
    setApplicants((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Ensure at least one primary if applicants remain
      if (!next.some((a) => a.isPrimary) && next.length > 0) {
        next[0]!.isPrimary = true;
      }
      return next;
    });
  };

  const handleSelectExistingApplicant = (applicantId: string) => {
    if (!applicantId) {
      setSelectedExistingApplicantId(null);
      setActiveApplicant({ ...DEFAULT_APPLICANT, isPrimary: editingApplicantIndex === 0 || applicants.length === 0 });
      return;
    }
    const found = existingApplicants.find((a: any) => a.id === applicantId);
    if (!found) return;

    setSelectedExistingApplicantId(found.id);
    setActiveApplicant((prev) => ({
      ...prev,
      id: found.id,
      firstName: found.firstName || '',
      lastName: found.lastName || '',
      gender: found.gender || 'MALE',
      dateOfBirth: found.dateOfBirth ? found.dateOfBirth.split('T')[0] : '1995-05-15',
      nationality: found.nationality || 'EG',
      passportNumber: found.passportMasked || found.passportNumber || '',
      passportExpiry: found.passportExpiry ? found.passportExpiry.split('T')[0] : '2030-01-01',
      phoneCountryCode: found.phoneCountryCode || '+20',
      phoneNumber: found.phoneNumber || found.phone?.replace(/^\+20/, '') || '',
      email: found.email || '',
    }));
  };

  const validateApplicantForm = (app: WizardApplicant): boolean => {
    const errs: Record<string, string> = {};
    if (!app.firstName.trim()) errs.firstName = locale === 'ar' ? 'الاسم الأول مطلوب' : 'First name required';
    if (!app.lastName.trim()) errs.lastName = locale === 'ar' ? 'اسم العائلة مطلوب' : 'Last name required';
    if (!app.gender) errs.gender = locale === 'ar' ? 'الجنس مطلوب' : 'Gender required';
    if (!app.dateOfBirth) {
      errs.dateOfBirth = locale === 'ar' ? 'تاريخ الميلاد مطلوب' : 'Date of birth required';
    } else if (new Date(app.dateOfBirth) > new Date()) {
      errs.dateOfBirth = locale === 'ar' ? 'تاريخ الميلاد لا يمكن أن يكون في المستقبل' : 'Date of birth cannot be in future';
    }
    if (!app.nationality.trim()) errs.nationality = locale === 'ar' ? 'الجنسية مطلوبة' : 'Nationality required';
    if (!app.passportNumber.trim()) {
      errs.passportNumber = locale === 'ar' ? 'رقم جواز السفر مطلوب' : 'Passport number required';
    } else if (!app.id && app.passportNumber.includes('*')) {
      errs.passportNumber = locale === 'ar' ? 'يرجى إدخال رقم جواز السفر كاملاً' : 'Full valid passport number required';
    }
    if (!app.passportExpiry) {
      errs.passportExpiry = locale === 'ar' ? 'تاريخ الانتهاء مطلوب' : 'Expiry date required';
    } else if (new Date(app.passportExpiry) <= new Date()) {
      errs.passportExpiry = locale === 'ar' ? 'جواز السفر منتهي الصلاحية' : 'Passport expiry must be future date';
    }
    if (!app.phoneCountryCode.trim()) errs.phoneCountryCode = locale === 'ar' ? 'رمز الدولة مطلوب' : 'Country code required';
    if (!app.phoneNumber.trim()) errs.phoneNumber = locale === 'ar' ? 'رقم الهاتف مطلوب' : 'Phone number required';
    if (app.isPrimary && !app.email.trim()) {
      errs.email = locale === 'ar' ? 'البريد الإلكتروني مطلوب للمتقدم الرئيسي' : 'Email required for primary applicant';
    } else if (app.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.email.trim())) {
      errs.email = locale === 'ar' ? 'صيغة البريد الإلكتروني غير صالحة' : 'Invalid email format';
    }

    setApplicantFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveActiveApplicant = () => {
    if (!validateApplicantForm(activeApplicant)) return;

    const sanitized: WizardApplicant = {
      ...activeApplicant,
      firstName: activeApplicant.firstName.trim(),
      lastName: activeApplicant.lastName.trim(),
      nationality: activeApplicant.nationality.trim().toUpperCase(),
      passportNumber: activeApplicant.passportNumber.trim().toUpperCase(),
      phoneCountryCode: activeApplicant.phoneCountryCode.trim(),
      phoneNumber: activeApplicant.phoneNumber.trim(),
      email: activeApplicant.email.trim(),
    };

    setApplicants((prev) => {
      let next = [...prev];
      if (editingApplicantIndex !== null && editingApplicantIndex >= 0) {
        next[editingApplicantIndex] = sanitized;
      } else {
        next.push(sanitized);
      }
      if (sanitized.isPrimary) {
        const targetIdx = editingApplicantIndex !== null ? editingApplicantIndex : next.length - 1;
        next = next.map((a, i) => ({ ...a, isPrimary: i === targetIdx }));
      }
      return next;
    });

    setShowApplicantModal(false);
  };

  // Toggle Optional Services
  const handleToggleService = (code?: string) => {
    if (!code) return;
    setServices((prev) =>
      prev.map((s) => (s.providerServiceCode === code ? { ...s, selected: !s.selected } : s))
    );
  };

  // 5 Step definitions
  const steps = [
    { number: 1, title: t('step1Title'), icon: MapPin },
    { number: 2, title: t('step2Title'), icon: Users },
    { number: 3, title: t('step3Title'), icon: Clock },
    { number: 4, title: t('step4Title'), icon: Sparkles },
    { number: 5, title: t('step5Title'), icon: ShieldCheck },
  ];

  // Final Submit Action
  async function handleFinalSubmit(markReady: boolean, startAutomation = false) {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (!selectedRouteId) {
        throw new Error('PROVIDER_ROUTE_NOT_FOUND');
      }
      if (applicants.length === 0) {
        throw new Error(locale === 'ar' ? 'يجب إضافة متقدم واحد على الأقل' : 'At least one applicant is required');
      }
      // Check completeness for all applicants
      for (let i = 0; i < applicants.length; i++) {
        const issue = checkApplicantCompleteness(applicants[i]!, i);
        if (issue) {
          throw new Error(issue);
        }
      }
      if (!providerTermsAccepted) {
        throw new Error(locale === 'ar' ? 'يجب الموافقة على الشروط والأحكام للمتابعة' : 'You must accept the Terms and Conditions to proceed');
      }

      // 1. Resolve / Create All Applicants
      const resolvedApplicantIds: { id: string; isPrimary: boolean; position: number }[] = [];

      for (let i = 0; i < applicants.length; i++) {
        const app = applicants[i]!;
        let applicantId = app.id;

        if (!applicantId) {
          try {
            const applicantPayload: any = {
              firstName: app.firstName.trim(),
              lastName: app.lastName.trim(),
              gender: app.gender,
              dateOfBirth: new Date(app.dateOfBirth).toISOString(),
              nationality: app.nationality.trim().toUpperCase(),
              passportNumber: app.passportNumber.trim().toUpperCase(),
              passportExpiry: new Date(app.passportExpiry).toISOString(),
            };
            if (app.phoneCountryCode?.trim()) applicantPayload.phoneCountryCode = app.phoneCountryCode.trim();
            if (app.phoneNumber?.trim()) applicantPayload.phoneNumber = app.phoneNumber.trim();
            if (app.phoneNumber?.trim()) {
              applicantPayload.phone = `${app.phoneCountryCode?.trim() || '+20'}${app.phoneNumber.trim()}`;
            }
            if (app.email?.trim()) applicantPayload.email = app.email.trim();

            const created = await api.applicants.create(applicantPayload);
            applicantId = created.id;
          } catch (err: any) {
            console.error('[Applicant Create Failed]:', err);
            if (err.details?.existingApplicantId) {
              applicantId = err.details.existingApplicantId;
            } else {
              const existing = await api.applicants.lookupByPassport(app.passportNumber.trim().toUpperCase()).catch(() => null);
              if (existing?.id) {
                applicantId = existing.id;
              } else {
                const valErrors = Array.isArray(err.details?.validationErrors)
                  ? err.details.validationErrors.join(', ')
                  : null;
                if (valErrors) {
                  throw new Error(
                    locale === 'ar'
                      ? `بيانات المتقدم (${app.firstName || ''} ${app.lastName || ''}) غير صحيحة: ${valErrors}`
                      : `Applicant (${app.firstName || ''} ${app.lastName || ''}) error: ${valErrors}`
                  );
                }
                throw err;
              }
            }
          }
        }

        if (!applicantId) {
          throw new Error('FAILED_TO_RESOLVE_APPLICANT');
        }

        resolvedApplicantIds.push({
          id: applicantId,
          isPrimary: app.isPrimary || i === 0,
          position: i + 1,
        });
      }

      // Filter selected optional services
      const selectedServicesList = services.filter((s) => s.selected);

      // 2. Create Booking Case
      const createdCase = await api.bookingCases.create({
        providerRouteId: selectedRouteId,
        appointmentSelectionMode,
        preferredDateFrom:
          appointmentSelectionMode === 'DATE_RANGE' && preferredDateFrom
            ? new Date(preferredDateFrom).toISOString()
            : undefined,
        preferredDateTo:
          appointmentSelectionMode === 'DATE_RANGE' && preferredDateTo
            ? new Date(preferredDateTo).toISOString()
            : undefined,
        preferredDate:
          (appointmentSelectionMode === 'EXACT_DATE' || appointmentSelectionMode === 'EXACT_DATE_AND_TIME') && preferredDate
            ? new Date(preferredDate).toISOString()
            : undefined,
        preferredTime: computedPreferredTimeString,
        preferredTimeFrom: appointmentSelectionMode === 'EXACT_DATE_AND_TIME' ? preferredTimeFrom : undefined,
        preferredTimeTo: appointmentSelectionMode === 'EXACT_DATE_AND_TIME' ? preferredTimeTo : undefined,
        acceptAnyAvailableTime,
        appointmentType,
        allowGroupSplit: applicants.length > 1 ? allowGroupSplit : false,
        servicesJson: selectedServicesList.length > 0 ? selectedServicesList : undefined,
        providerTermsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        marketingConsent,
        marketingConsentAt: marketingConsent ? new Date().toISOString() : undefined,
      });

      // 3. Attach all applicants
      for (const item of resolvedApplicantIds) {
        await api.bookingCases.addApplicant(createdCase.id, {
          applicantId: item.id,
          relation: item.isPrimary ? 'PRIMARY' : 'OTHER',
          isPrimary: item.isPrimary,
          position: item.position,
        });
      }

      // 4. Transition to READY if requested
      if (markReady || startAutomation) {
        await api.bookingCases.markReady(createdCase.id);
      }

      // 5. Start Automation Bot if requested
      if (startAutomation) {
        await api.orchestrator.startAutomation(createdCase.id).catch(() => {});
      }

      // 6. Navigate to Case Detail
      router.push(`/bookings/${createdCase.id}`);
    } catch (err: any) {
      console.error('[Booking Final Submit Error]:', err);
      const valErrors = Array.isArray(err.details?.validationErrors)
        ? `: ${err.details.validationErrors.join(', ')}`
        : '';
      const baseMsg = err.message || (locale === 'ar' ? 'فشلت العملية' : 'Operation failed');
      setErrorMsg(`${getLocalizedErrorMessage(baseMsg, locale)}${valErrors}`);
      setSubmitting(false);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            {t('title')}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            {t('subtitle')}
          </p>
        </div>

        {/* Step Progress Bar */}
        <div
          id="wizard-step-progress"
          className="glass-card"
          style={{
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            overflowX: 'auto',
          }}
        >
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isDone = currentStep > step.number;
            const isCurrent = currentStep === step.number;

            return (
              <React.Fragment key={step.number}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    opacity: isCurrent || isDone ? 1 : 0.45,
                    cursor: isDone ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                  onClick={() => {
                    if (isDone) setCurrentStep(step.number);
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isDone
                        ? '#10b981'
                        : isCurrent
                        ? '#3b82f6'
                        : 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      boxShadow: isCurrent ? '0 0 12px rgba(59, 130, 246, 0.5)' : undefined,
                    }}
                  >
                    {isDone ? <Check size={16} /> : formatNumber(step.number, locale)}
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: isCurrent ? '#60a5fa' : '#94a3b8',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        display: 'block',
                      }}
                    >
                      {step.title}
                    </span>
                  </div>
                </div>

                {idx < steps.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      minWidth: '20px',
                      height: '2px',
                      backgroundColor: currentStep > idx + 1 ? '#10b981' : 'rgba(255,255,255,0.1)',
                      margin: '0 12px',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            id="wizard-error-alert"
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Wizard Form Card */}
        <div className="glass-card" style={{ padding: '32px' }}>
          {/* STEP 1: VISA ROUTE */}
          {currentStep === 1 && (
            <div id="wizard-step-1" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
                    {t('step1Title')}
                  </h1>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#93c5fd',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    VFS.GLOBAL
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  {t('step1Desc')}
                </p>
              </div>

              {routesLoading ? (
                <div style={{ padding: '32px', color: '#94a3b8', textAlign: 'center' }}>
                  {tCommon('loading')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Dropdown 1: Destination Country */}
                  <div>
                    <label
                      htmlFor="select-destination-country"
                      style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        marginBottom: '8px',
                      }}
                    >
                      {t('destinationCountry')}
                      <span style={{ color: '#ef4444', marginInlineStart: '4px' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        id="select-destination-country"
                        value={destinationCountry}
                        onChange={(e) => handleDestinationChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: '#0c1322',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          borderRadius: '8px',
                          color: destinationCountry ? '#f8fafc' : '#94a3b8',
                          fontSize: '0.9rem',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled style={{ backgroundColor: '#0c1322', color: '#64748b' }}>
                          {locale === 'ar' ? 'اختر دولة الوجهة' : 'Choose destination country'}
                        </option>
                        {availableDestinations.map((dest) => (
                          <option key={dest} value={dest} style={{ backgroundColor: '#0c1322', color: '#f8fafc' }}>
                            {getCountryName(dest)} ({dest})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dropdown 2: Application Centre */}
                  {destinationCountry && (
                    <div>
                      <label
                        htmlFor="select-application-centre"
                        style={{
                          display: 'block',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          marginBottom: '8px',
                        }}
                      >
                        {t('applicationCentre')}
                        <span style={{ color: '#ef4444', marginInlineStart: '4px' }}>*</span>
                      </label>
                      <select
                        id="select-application-centre"
                        value={applicationCentre}
                        onChange={(e) => handleCentreChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: '#0c1322',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          borderRadius: '8px',
                          color: applicationCentre ? '#f8fafc' : '#94a3b8',
                          fontSize: '0.9rem',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled style={{ backgroundColor: '#0c1322', color: '#64748b' }}>
                          {locale === 'ar' ? 'اختر مركز التقديم' : 'Select application centre'}
                        </option>
                        {availableCentres.map((centre) => (
                          <option key={centre} value={centre} style={{ backgroundColor: '#0c1322', color: '#f8fafc' }}>
                            {centre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Dropdown 3: Category */}
                  {applicationCentre && (
                    <div>
                      <label
                        htmlFor="select-visa-category"
                        style={{
                          display: 'block',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          marginBottom: '8px',
                        }}
                      >
                        {t('visaCategory')}
                        <span style={{ color: '#ef4444', marginInlineStart: '4px' }}>*</span>
                      </label>
                      <select
                        id="select-visa-category"
                        value={visaCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: '#0c1322',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          borderRadius: '8px',
                          color: visaCategory ? '#f8fafc' : '#94a3b8',
                          fontSize: '0.9rem',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled style={{ backgroundColor: '#0c1322', color: '#64748b' }}>
                          {locale === 'ar' ? 'اختر فئة الموعد' : 'Select category'}
                        </option>
                        {availableCategories.map((cat) => (
                          <option key={cat} value={cat} style={{ backgroundColor: '#0c1322', color: '#f8fafc' }}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Dropdown 4: Subcategory */}
                  {visaCategory && (
                    <div>
                      <label
                        htmlFor="select-visa-subcategory"
                        style={{
                          display: 'block',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          marginBottom: '8px',
                        }}
                      >
                        {t('visaSubcategory')}
                        <span style={{ color: '#ef4444', marginInlineStart: '4px' }}>*</span>
                      </label>
                      <select
                        id="select-visa-subcategory"
                        value={visaSubcategory}
                        onChange={(e) => handleSubcategoryChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: '#0c1322',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          borderRadius: '8px',
                          color: visaSubcategory ? '#f8fafc' : '#94a3b8',
                          fontSize: '0.9rem',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled style={{ backgroundColor: '#0c1322', color: '#64748b' }}>
                          {locale === 'ar' ? 'اختر الفئة الفرعية' : 'Select sub-category'}
                        </option>
                        {availableSubcategories.map((sub) => (
                          <option key={sub} value={sub} style={{ backgroundColor: '#0c1322', color: '#f8fafc' }}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Route Selected Success Alert */}
                  {selectedRouteId && (
                    <div
                      id="vfs-slot-notification-banner"
                      style={{
                        marginTop: '8px',
                        padding: '14px 18px',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '8px',
                        color: '#6ee7b7',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.875rem',
                      }}
                    >
                      <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span>
                        {locale === 'ar'
                          ? 'تم تحديد المسار بنجاح وفقاً لمعايير VFS Global الرسمية.'
                          : 'Route configured successfully according to official VFS Global criteria.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: APPLICANTS (MULTI-APPLICANT SUPPORT) */}
          {currentStep === 2 && (
            <div id="wizard-step-2" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    {t('step2Title')} ({applicants.length})
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
                    {t('step2Desc')}
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-add-applicant"
                  onClick={handleOpenAddApplicant}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
                >
                  <Plus size={16} />
                  <span>{t('addAnotherApplicant')}</span>
                </button>
              </div>

              {/* Applicants Table or Empty State */}
              {applicants.length === 0 ? (
                <div
                  id="applicants-empty-state"
                  style={{
                    textAlign: 'center',
                    padding: '48px 24px',
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  }}
                >
                  <Users size={40} color="#60a5fa" style={{ marginBottom: '12px', opacity: 0.8 }} />
                  <h4 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 600, margin: '0 0 6px 0' }}>
                    {t('noApplicantsYet')}
                  </h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 16px 0', maxWidth: '420px', marginInline: 'auto' }}>
                    {t('noApplicantsDesc')}
                  </p>
                  <button
                    type="button"
                    id="btn-add-primary-applicant"
                    onClick={handleOpenAddApplicant}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                  >
                    <Plus size={16} />
                    <span>{t('addPrimaryApplicant')}</span>
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    id="applicants-summary-table"
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      textAlign: 'start',
                      fontSize: '0.875rem',
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'start' }}>#</th>
                        <th style={{ padding: '10px 8px', textAlign: 'start' }}>{t('fullName')}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'start' }}>{t('passportNumber')}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'start' }}>{t('nationality')}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'start' }}>{t('dateOfBirth')}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'start' }}>{t('passportExpiryDate')}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'start' }}>{t('contactNumber')}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'start' }}>{t('email')}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>{tCommon('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicants.map((app, idx) => {
                        const completenessIssue = checkApplicantCompleteness(app, idx);
                        const maskedPassport = app.passportNumber
                          ? app.passportNumber.includes('*')
                            ? app.passportNumber
                            : `${app.passportNumber.slice(0, 1)}****${app.passportNumber.slice(-3)}`
                          : '—';

                        return (
                          <tr
                            key={idx}
                            id={`applicant-item-${idx}`}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              backgroundColor: completenessIssue ? 'rgba(239, 68, 68, 0.04)' : undefined,
                            }}
                          >
                            <td style={{ padding: '12px 8px', color: '#94a3b8' }}>{idx + 1}</td>
                            <td style={{ padding: '12px 8px', fontWeight: 600, color: '#f8fafc' }}>
                              {app.firstName || '—'} {app.lastName || ''}
                              {app.isPrimary && (
                                <span
                                  style={{
                                    marginInlineStart: '6px',
                                    fontSize: '0.7rem',
                                    color: '#60a5fa',
                                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {tCommon('primary')}
                                </span>
                              )}
                              {completenessIssue && (
                                <span
                                  style={{
                                    marginInlineStart: '6px',
                                    fontSize: '0.7rem',
                                    color: '#f59e0b',
                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                  title={completenessIssue}
                                >
                                  {t('incomplete')}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                              {maskedPassport}
                            </td>
                            <td style={{ padding: '12px 8px', color: '#94a3b8' }}>{app.nationality}</td>
                            <td style={{ padding: '12px 8px', color: '#94a3b8' }}>{app.dateOfBirth}</td>
                            <td style={{ padding: '12px 8px', color: '#94a3b8' }}>{app.passportExpiry}</td>
                            <td style={{ padding: '12px 8px', color: '#94a3b8', direction: 'ltr', textAlign: 'start' }}>
                              {app.phoneCountryCode} {app.phoneNumber}
                            </td>
                            <td style={{ padding: '12px 8px', color: '#94a3b8' }}>{app.email || '—'}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditApplicant(idx)}
                                  title={t('editApplicant')}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#60a5fa',
                                    cursor: 'pointer',
                                    padding: '4px',
                                  }}
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveApplicant(idx)}
                                  title={t('removeApplicant')}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#f87171',
                                    cursor: 'pointer',
                                    padding: '4px',
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Applicant Edit / Add Modal or Inline Card */}
              {showApplicantModal && (
                <div
                  id="applicant-form-modal"
                  style={{
                    marginTop: '12px',
                    padding: '24px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#93c5fd', margin: 0 }}>
                      {editingApplicantIndex !== null ? t('editApplicant') : t('addApplicant')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowApplicantModal(false)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Database Applicant Quick Selector */}
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <Database size={16} color="#60a5fa" />
                    <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600 }}>
                      {t('orSelectSaved')}
                    </span>
                    <select
                      id="select-existing-applicant"
                      value={selectedExistingApplicantId || ''}
                      onChange={(e) => handleSelectExistingApplicant(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        backgroundColor: '#0c1322',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    >
                      <option value="">{t('selectExistingApplicant')}</option>
                      {existingApplicants.map((app: any) => (
                        <option key={app.id} value={app.id}>
                          {app.firstName} {app.lastName} • {app.passportMasked || app.passportNumber} ({app.nationality})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Inputs Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    {/* First Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('firstName')} *
                      </label>
                      <input
                        id="input-applicant-first-name"
                        type="text"
                        value={activeApplicant.firstName}
                        onChange={(e) => setActiveApplicant({ ...activeApplicant, firstName: e.target.value })}
                        placeholder="TAREK"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-input)',
                          border: applicantFormErrors.firstName ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      />
                      {applicantFormErrors.firstName && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{applicantFormErrors.firstName}</span>
                      )}
                    </div>

                    {/* Last Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('lastName')} *
                      </label>
                      <input
                        id="input-applicant-last-name"
                        type="text"
                        value={activeApplicant.lastName}
                        onChange={(e) => setActiveApplicant({ ...activeApplicant, lastName: e.target.value })}
                        placeholder="GAWESH"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-input)',
                          border: applicantFormErrors.lastName ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      />
                      {applicantFormErrors.lastName && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{applicantFormErrors.lastName}</span>
                      )}
                    </div>

                    {/* Gender */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('gender')} *
                      </label>
                      <select
                        id="select-applicant-gender"
                        value={activeApplicant.gender}
                        onChange={(e) => setActiveApplicant({ ...activeApplicant, gender: e.target.value as any })}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      >
                        <option value="MALE">{t('genderMale')}</option>
                        <option value="FEMALE">{t('genderFemale')}</option>
                      </select>
                    </div>

                    {/* Date Of Birth */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('dateOfBirth')} *
                      </label>
                      <input
                        id="input-applicant-dob"
                        type="date"
                        dir="ltr"
                        max={new Date().toISOString().split('T')[0]}
                        value={activeApplicant.dateOfBirth}
                        onChange={(e) => setActiveApplicant({ ...activeApplicant, dateOfBirth: e.target.value })}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-input)',
                          border: applicantFormErrors.dateOfBirth ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      />
                      {applicantFormErrors.dateOfBirth && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{applicantFormErrors.dateOfBirth}</span>
                      )}
                    </div>

                    {/* Nationality */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('currentNationality')} *
                      </label>
                      <input
                        id="input-applicant-nationality"
                        type="text"
                        dir="ltr"
                        value={activeApplicant.nationality}
                        onChange={(e) => setActiveApplicant({ ...activeApplicant, nationality: e.target.value.toUpperCase() })}
                        placeholder="EG"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-input)',
                          border: applicantFormErrors.nationality ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      />
                      {applicantFormErrors.nationality && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{applicantFormErrors.nationality}</span>
                      )}
                    </div>

                    {/* Passport Number */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('passportNumber')} *
                      </label>
                      <input
                        id="input-applicant-passport"
                        type="text"
                        dir="ltr"
                        value={activeApplicant.passportNumber}
                        onChange={(e) => setActiveApplicant({ ...activeApplicant, passportNumber: e.target.value.toUpperCase() })}
                        placeholder="A12345678"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-input)',
                          border: applicantFormErrors.passportNumber ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          outline: 'none',
                          fontFamily: 'monospace',
                        }}
                      />
                      {applicantFormErrors.passportNumber && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{applicantFormErrors.passportNumber}</span>
                      )}
                    </div>

                    {/* Passport Expiry Date */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('passportExpiryDate')} *
                      </label>
                      <input
                        id="input-applicant-passport-expiry"
                        type="date"
                        dir="ltr"
                        min={new Date().toISOString().split('T')[0]}
                        value={activeApplicant.passportExpiry}
                        onChange={(e) => setActiveApplicant({ ...activeApplicant, passportExpiry: e.target.value })}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-input)',
                          border: applicantFormErrors.passportExpiry ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      />
                      {applicantFormErrors.passportExpiry && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{applicantFormErrors.passportExpiry}</span>
                      )}
                    </div>

                    {/* Phone Country Code & Number */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('contactNumber')} *
                      </label>
                      <div style={{ display: 'flex', gap: '6px', direction: 'ltr' }}>
                        <input
                          id="input-applicant-phone-code"
                          type="text"
                          style={{
                            width: '80px',
                            boxSizing: 'border-box',
                            padding: '10px 10px',
                            backgroundColor: 'var(--bg-input)',
                            border: applicantFormErrors.phoneCountryCode ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            fontSize: '0.875rem',
                            outline: 'none',
                            textAlign: 'center',
                          }}
                          value={activeApplicant.phoneCountryCode}
                          onChange={(e) => setActiveApplicant({ ...activeApplicant, phoneCountryCode: e.target.value })}
                          placeholder="+20"
                        />
                        <input
                          id="input-applicant-phone-num"
                          type="text"
                          style={{
                            flex: 1,
                            boxSizing: 'border-box',
                            padding: '10px 12px',
                            backgroundColor: 'var(--bg-input)',
                            border: applicantFormErrors.phoneNumber ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            fontSize: '0.875rem',
                            outline: 'none',
                          }}
                          value={activeApplicant.phoneNumber}
                          onChange={(e) => setActiveApplicant({ ...activeApplicant, phoneNumber: e.target.value })}
                          placeholder="1001234567"
                        />
                      </div>
                      {(applicantFormErrors.phoneCountryCode || applicantFormErrors.phoneNumber) && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                          {applicantFormErrors.phoneCountryCode || applicantFormErrors.phoneNumber}
                        </span>
                      )}
                    </div>

                    {/* Email */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {t('email')} *
                      </label>
                      <input
                        id="input-applicant-email"
                        type="email"
                        dir="ltr"
                        value={activeApplicant.email}
                        onChange={(e) => setActiveApplicant({ ...activeApplicant, email: e.target.value })}
                        placeholder="tarek.gawesh@example.com"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-input)',
                          border: applicantFormErrors.email ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      />
                      {applicantFormErrors.email && (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{applicantFormErrors.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Primary toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input
                      id="checkbox-primary-applicant"
                      type="checkbox"
                      checked={activeApplicant.isPrimary}
                      onChange={(e) => setActiveApplicant({ ...activeApplicant, isPrimary: e.target.checked })}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <label htmlFor="checkbox-primary-applicant" style={{ fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      {t('primaryApplicant')}
                    </label>
                  </div>

                  {/* Modal Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowApplicantModal(false)}
                      className="btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      {tCommon('cancel')}
                    </button>
                    <button
                      type="button"
                      id="btn-save-applicant-form"
                      onClick={handleSaveActiveApplicant}
                      className="btn-primary"
                      style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                    >
                      {t('saveApplicantToList')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: APPOINTMENT PREFERENCES */}
          {currentStep === 3 && (
            <div id="wizard-step-3" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  {t('step3Title')}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
                  {t('step3Desc')}
                </p>
              </div>

              {/* Selection Mode Selection Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                  {t('selectionMode')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {[
                    { mode: 'ANY_AVAILABLE', title: t('modeAnyAvailable'), desc: t('modeAnyAvailableDesc') },
                    { mode: 'DATE_RANGE', title: t('modeDateRange'), desc: t('modeDateRangeDesc') },
                    { mode: 'EXACT_DATE', title: t('modeExactDate'), desc: t('modeExactDateDesc') },
                    { mode: 'EXACT_DATE_AND_TIME', title: t('modeExactDateTime'), desc: t('modeExactDateTimeDesc') },
                  ].map((m) => {
                    const isSelected = appointmentSelectionMode === m.mode;
                    return (
                      <button
                        key={m.mode}
                        type="button"
                        id={`mode-select-${m.mode}`}
                        onClick={() => setAppointmentSelectionMode(m.mode as any)}
                        style={{
                          padding: '14px',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                          textAlign: 'start',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: isSelected ? '#93c5fd' : '#f8fafc' }}>
                          {m.title}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {m.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Date Pickers based on Mode */}
              {appointmentSelectionMode === 'DATE_RANGE' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                      {t('preferredDateFrom')} *
                    </label>
                    <input
                      id="input-pref-date-from"
                      type="date"
                      dir="ltr"
                      min={new Date().toISOString().split('T')[0]}
                      value={preferredDateFrom}
                      onChange={(e) => setPreferredDateFrom(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                      {t('preferredDateTo')} *
                    </label>
                    <input
                      id="input-pref-date-to"
                      type="date"
                      dir="ltr"
                      min={preferredDateFrom || new Date().toISOString().split('T')[0]}
                      value={preferredDateTo}
                      onChange={(e) => setPreferredDateTo(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}

              {(appointmentSelectionMode === 'EXACT_DATE' || appointmentSelectionMode === 'EXACT_DATE_AND_TIME') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {t('preferredDate')} *
                  </label>
                  <input
                    id="input-pref-exact-date"
                    type="date"
                    dir="ltr"
                    min={new Date().toISOString().split('T')[0]}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    style={{
                      width: '100%',
                      maxWidth: '360px',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {appointmentSelectionMode === 'EXACT_DATE_AND_TIME' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                      {t('preferredTimeFrom')}
                    </label>
                    <input
                      id="input-pref-time-from"
                      type="time"
                      value={preferredTimeFrom}
                      onChange={(e) => setPreferredTimeFrom(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                      {t('preferredTimeTo')}
                    </label>
                    <input
                      id="input-pref-time-to"
                      type="time"
                      value={preferredTimeTo}
                      onChange={(e) => setPreferredTimeTo(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Accept any available time checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="checkbox-accept-any-time"
                  type="checkbox"
                  checked={acceptAnyAvailableTime}
                  onChange={(e) => setAcceptAnyAvailableTime(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="checkbox-accept-any-time" style={{ fontSize: '0.875rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  {t('acceptAnyAvailableTime')}
                </label>
              </div>

              {/* Appointment Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  {t('appointmentType')}
                </label>
                <input
                  id="input-appointment-type"
                  type="text"
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                  placeholder="STANDARD"
                  style={{
                    width: '100%',
                    maxWidth: '360px',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Allow Group Split Checkbox (if >1 applicant) */}
              {applicants.length > 1 && (
                <div
                  style={{
                    padding: '14px 18px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="checkbox-group-split"
                      type="checkbox"
                      checked={allowGroupSplit}
                      onChange={(e) => setAllowGroupSplit(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="checkbox-group-split" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', cursor: 'pointer' }}>
                      {t('allowGroupSplit')}
                    </label>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', paddingInlineStart: '24px' }}>
                    {t('allowGroupSplitDesc')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: OPTIONAL SERVICES (DEFAULT: NONE SELECTED) */}
          {currentStep === 4 && (
            <div id="wizard-step-4" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  {t('servicesTitle')}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
                  {t('servicesDesc')}
                </p>
              </div>

              {/* Authority Disclaimer Notice */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '8px',
                  color: '#93c5fd',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Info size={16} style={{ flexShrink: 0 }} />
                <span>{t('providerPriceAuthority')}</span>
              </div>

              {/* Services Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {services.map((serv) => (
                  <div
                    key={serv.providerServiceCode}
                    id={`service-card-${serv.providerServiceCode}`}
                    onClick={() => handleToggleService(serv.providerServiceCode)}
                    style={{
                      padding: '18px 20px',
                      borderRadius: '10px',
                      backgroundColor: serv.selected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: serv.selected ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <input
                        type="checkbox"
                        checked={serv.selected}
                        onChange={() => {}}
                        style={{ marginTop: '4px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                          {serv.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                          {serv.description}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'end', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: serv.selected ? '#93c5fd' : '#f8fafc' }}>
                        {serv.price} {serv.currency}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {t('priceOnProvider')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status summary */}
              {!services.some((s) => s.selected) && (
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    color: '#6ee7b7',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{t('noServicesSelected')} — {t('noServicesSelectedDesc')}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: REVIEW */}
          {currentStep === 5 && (
            <div id="wizard-step-5" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  {t('step5Title')}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
                  {t('step5Desc')}
                </p>
              </div>

              {/* Review Sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. Route Summary */}
                <div
                  className="glass-card"
                  style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                      {t('reviewRoute')}
                    </span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
                      {providerCode} • {getCountryName(sourceCountry)} → {getCountryName(destinationCountry)} • {applicationCentre} ({visaCategory} - {visaSubcategory})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    {t('editRoute')}
                  </button>
                </div>

                {/* 2. Applicants Summary */}
                <div
                  className="glass-card"
                  style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                      {t('reviewApplicants')} ({applicants.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      {t('editApplicants')}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {applicants.map((a, i) => {
                      const issue = checkApplicantCompleteness(a, i);
                      const passportDisplay = a.passportNumber
                        ? a.passportNumber.includes('*')
                          ? a.passportNumber
                          : `${a.passportNumber.slice(0, 1)}****${a.passportNumber.slice(-3)}`
                        : '—';

                      return (
                        <div
                          key={i}
                          style={{
                            padding: '10px 12px',
                            backgroundColor: issue ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            border: issue ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem',
                          }}
                        >
                          <div>
                            <strong>{a.firstName || '—'} {a.lastName || ''}</strong>
                            {a.isPrimary && (
                              <span style={{ marginInlineStart: '6px', color: '#60a5fa', fontSize: '0.75rem' }}>
                                ({tCommon('primary')})
                              </span>
                            )}
                            {issue && (
                              <span style={{ marginInlineStart: '6px', color: '#ef4444', fontSize: '0.75rem' }}>
                                ({issue})
                              </span>
                            )}
                            <span style={{ marginInlineStart: '10px', color: '#94a3b8' }}>
                              Passport: <TechnicalText>{passportDisplay}</TechnicalText>
                            </span>
                          </div>
                          <span style={{ color: '#94a3b8', direction: 'ltr' }}>
                            {a.phoneCountryCode} {a.phoneNumber}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Appointment Preferences Summary */}
                <div
                  className="glass-card"
                  style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                      {t('reviewPreferences')}
                    </span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
                      {appointmentSelectionMode === 'ANY_AVAILABLE' && t('modeAnyAvailable')}
                      {appointmentSelectionMode === 'DATE_RANGE' && `${t('modeDateRange')}: ${preferredDateFrom} → ${preferredDateTo}`}
                      {appointmentSelectionMode === 'EXACT_DATE' && `${t('modeExactDate')}: ${preferredDate}`}
                      {appointmentSelectionMode === 'EXACT_DATE_AND_TIME' && `${t('modeExactDateTime')}: ${preferredDate} (${preferredTimeFrom} - ${preferredTimeTo})`}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '2px' }}>
                      🤖 {computedPreferredTimeString}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    {t('editPreferences')}
                  </button>
                </div>

                {/* 4. Services Summary */}
                <div
                  className="glass-card"
                  style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                      {t('reviewServices')}
                    </span>
                    <div style={{ fontSize: '0.875rem', color: '#f8fafc', marginTop: '4px' }}>
                      {services.some((s) => s.selected) ? (
                        services
                          .filter((s) => s.selected)
                          .map((s) => `${s.name} (${s.price} ${s.currency})`)
                          .join(', ')
                      ) : (
                        <span style={{ color: '#6ee7b7' }}>{t('noServicesSelected')}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    {t('editServices')}
                  </button>
                </div>

                {/* 5. Payment Notice */}
                <div
                  style={{
                    padding: '14px 18px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    color: '#fde68a',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Info size={18} style={{ flexShrink: 0 }} />
                  <span>{t('paymentManualNotice')}</span>
                </div>

                {/* 6. Terms & Conditions (Mandatory) & Marketing Consent (Optional) */}
                <div
                  style={{
                    padding: '18px 20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {/* Required Terms */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <input
                      id="checkbox-provider-terms"
                      type="checkbox"
                      checked={providerTermsAccepted}
                      onChange={(e) => setProviderTermsAccepted(e.target.checked)}
                      style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label
                      htmlFor="checkbox-provider-terms"
                      style={{ fontSize: '0.875rem', color: '#f8fafc', cursor: 'pointer', lineHeight: 1.4 }}
                    >
                      <strong style={{ color: '#ef4444' }}>* </strong>
                      {t('providerTermsAcceptedLabel')}
                    </label>
                  </div>

                  {/* Optional Marketing Consent (DEFAULTS TO FALSE, NEVER PRESELECTED) */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <input
                      id="checkbox-marketing-consent"
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label
                      htmlFor="checkbox-marketing-consent"
                      style={{ fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer', lineHeight: 1.4 }}
                    >
                      {t('marketingConsentLabel')}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div
            style={{
              marginTop: '32px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
                className="btn-secondary"
                id="btn-wizard-prev"
              >
                <ChevronLeft size={16} className="icon-directional" />
                <span>{tCommon('back')}</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                disabled={
                  (currentStep === 1 && !selectedRouteId) ||
                  (currentStep === 2 && applicants.length === 0)
                }
                onClick={() => {
                  setErrorMsg(null);
                  if (currentStep === 1 && !selectedRouteId) return;
                  if (currentStep === 2) {
                    if (applicants.length === 0) {
                      setErrorMsg(t('atLeastOneApplicant'));
                      return;
                    }
                    for (let i = 0; i < applicants.length; i++) {
                      const issue = checkApplicantCompleteness(applicants[i]!, i);
                      if (issue) {
                        setErrorMsg(issue);
                        if (typeof window !== 'undefined') {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                        return;
                      }
                    }
                  }
                  setCurrentStep((s) => s + 1);
                }}
                className="btn-primary"
                id="btn-wizard-next"
                style={{
                  opacity:
                    (currentStep === 1 && !selectedRouteId) || (currentStep === 2 && applicants.length === 0)
                      ? 0.5
                      : 1,
                  cursor:
                    (currentStep === 1 && !selectedRouteId) || (currentStep === 2 && applicants.length === 0)
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                <span>{tCommon('next')}</span>
                <ChevronRight size={16} className="icon-directional" />
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleFinalSubmit(false, false)}
                  className="btn-secondary"
                  id="btn-submit-draft"
                >
                  <span>{t('saveDraft')}</span>
                </button>
                <button
                  type="button"
                  disabled={submitting || !providerTermsAccepted}
                  onClick={() => handleFinalSubmit(true, false)}
                  className="btn-secondary"
                  id="btn-submit-ready"
                  style={{
                    opacity: !providerTermsAccepted ? 0.5 : 1,
                    cursor: !providerTermsAccepted ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>{submitting ? tCommon('loading') : t('markReady')}</span>
                </button>
                <button
                  type="button"
                  disabled={submitting || !providerTermsAccepted}
                  onClick={() => handleFinalSubmit(true, true)}
                  className="btn-success"
                  id="btn-submit-start-bot"
                  style={{
                    opacity: !providerTermsAccepted ? 0.5 : 1,
                    cursor: !providerTermsAccepted ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Sparkles size={16} />
                  <span>{submitting ? tCommon('loading') : t('startBot')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

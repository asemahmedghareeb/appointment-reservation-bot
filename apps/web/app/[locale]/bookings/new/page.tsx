'use client';

import React, { useState } from 'react';
import { useRouter } from '../../../../i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { TechnicalText } from '../../../../components/ui/technical-text';
import { getLocalizedErrorMessage } from '../../../../lib/formatters/errors';
import { formatNumber } from '../../../../lib/formatters/numbers';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Calendar,
  User,
  MapPin,
  Clock,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Timer,
  Zap,
  Database,
  UserCheck,
  RotateCcw,
  Lock,
} from 'lucide-react';

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

  // Progressive Route Form State
  const [providerCode, setProviderCode] = useState<string>('VFS');
  const [sourceCountry, setSourceCountry] = useState<string>('EG');
  const [destinationCountry, setDestinationCountry] = useState<string>('');
  const [applicationCentre, setApplicationCentre] = useState<string>('');
  const [visaCategory, setVisaCategory] = useState<string>('');
  const [visaSubcategory, setVisaSubcategory] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');

  const [applicantData, setApplicantData] = useState({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    dateOfBirth: '1995-05-15',
    nationality: 'EG',
    phone: '+201001234567',
    email: 'applicant@example.com',
    passportNumber: '',
    passportExpiry: '2030-01-01',
  });
  const [preferences, setPreferences] = useState({
    bookingMode: 'INDIVIDUAL',
    preferredDateFrom: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0] ?? '',
    preferredDateTo: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0] ?? '',
    preferredTime: 'MORNING',
    allowGroupSplit: false,
  });

  // Bot Scheduling & Execution Window State
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

  const computedPreferredTimeString = React.useMemo(() => {
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

  // Query Enabled Routes for Provider & Source Country
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

  // Existing Database Records for Quick Auto-Fill
  const [selectedExistingApplicantId, setSelectedExistingApplicantId] = useState<string | null>(null);

  const { data: existingApplicantsData, isLoading: loadingExistingApplicants } = useQuery({
    queryKey: ['existing-applicants-list'],
    queryFn: () => api.applicants.list({ limit: 100 }),
  });
  const existingApplicants = existingApplicantsData?.items || [];

  const handleSelectExistingApplicant = (applicantId: string) => {
    if (!applicantId) {
      handleClearSelectedApplicant();
      return;
    }
    const found = existingApplicants.find((a: any) => a.id === applicantId);
    if (!found) return;

    setSelectedExistingApplicantId(found.id);
    setApplicantData({
      firstName: found.firstName || '',
      lastName: found.lastName || '',
      gender: found.gender || 'MALE',
      dateOfBirth: found.dateOfBirth ? found.dateOfBirth.split('T')[0] : '1995-05-15',
      nationality: found.nationality || 'EG',
      phone: found.phone || '',
      email: found.email || '',
      passportNumber: found.passportMasked || '',
      passportExpiry: found.passportExpiry ? found.passportExpiry.split('T')[0] : '2030-01-01',
    });
  };

  const handleClearSelectedApplicant = () => {
    setSelectedExistingApplicantId(null);
    setApplicantData({
      firstName: '',
      lastName: '',
      gender: 'MALE',
      dateOfBirth: '1995-05-15',
      nationality: 'EG',
      phone: '+201001234567',
      email: 'applicant@example.com',
      passportNumber: '',
      passportExpiry: '2030-01-01',
    });
  };

  // Derived progressive options
  const availableDestinations = React.useMemo(() => {
    if (!routes) return [];
    return Array.from(new Set(routes.map((r: any) => r.destinationCountry))).filter(Boolean) as string[];
  }, [routes]);

  const availableCentres = React.useMemo(() => {
    if (!routes || !destinationCountry) return [];
    return Array.from(
      new Set(
        routes
          .filter((r: any) => r.destinationCountry === destinationCountry)
          .map((r: any) => r.applicationCentre)
      )
    ).filter(Boolean) as string[];
  }, [routes, destinationCountry]);

  const availableCategories = React.useMemo(() => {
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

  const availableSubcategories = React.useMemo(() => {
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

  const matchingRoutes = React.useMemo(() => {
    if (!routes) return [];
    return routes.filter((r: any) => {
      if (destinationCountry && r.destinationCountry !== destinationCountry) return false;
      if (applicationCentre && r.applicationCentre !== applicationCentre) return false;
      if (visaCategory && r.visaCategory !== visaCategory) return false;
      if (visaSubcategory && r.visaSubcategory !== visaSubcategory) return false;
      return true;
    });
  }, [routes, destinationCountry, applicationCentre, visaCategory, visaSubcategory]);

  const selectedRouteObj = React.useMemo(() => {
    return routes?.find((r: any) => r.id === selectedRouteId) || null;
  }, [routes, selectedRouteId]);

  // Destination Reset Rules
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

  const handleSelectRouteDirect = (route: any) => {
    setSelectedRouteId(route.id);
    setDestinationCountry(route.destinationCountry);
    setApplicationCentre(route.applicationCentre);
    setVisaCategory(route.visaCategory);
    setVisaSubcategory(route.visaSubcategory);
  };

  const steps = [
    { number: 1, title: t('step1Title'), icon: MapPin },
    { number: 2, title: t('step2Title'), icon: User },
    { number: 3, title: t('step3Title'), icon: Clock },
    { number: 4, title: t('step4Title'), icon: ShieldCheck },
  ];

  async function handleFinalSubmit(markReady: boolean) {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (!selectedRouteId) {
        throw new Error('PROVIDER_ROUTE_NOT_FOUND');
      }
      if (!applicantData.firstName || !applicantData.lastName || !applicantData.passportNumber) {
        throw new Error('INVALID_PRIMARY_APPLICANT');
      }

      // 1. Create Applicant (or reuse if already exists or selected from DB)
      let applicantId: string;
      if (selectedExistingApplicantId) {
        applicantId = selectedExistingApplicantId;
      } else {
        try {
          const createdApplicant = await api.applicants.create({
            firstName: applicantData.firstName.trim(),
            lastName: applicantData.lastName.trim(),
            gender: applicantData.gender,
            dateOfBirth: new Date(applicantData.dateOfBirth).toISOString(),
            nationality: applicantData.nationality.trim(),
            phone: applicantData.phone || undefined,
            email: applicantData.email || undefined,
            passportNumber: applicantData.passportNumber.trim().toUpperCase(),
            passportExpiry: new Date(applicantData.passportExpiry).toISOString(),
          });
          applicantId = createdApplicant.id;
        } catch (err: any) {
          // If applicant already exists with this passport, reuse existing applicant ID directly or lookup
          if (err.details?.existingApplicantId) {
            applicantId = err.details.existingApplicantId;
          } else {
            try {
              const existing = await api.applicants.lookupByPassport(applicantData.passportNumber.trim().toUpperCase());
              if (existing?.id) {
                applicantId = existing.id;
              } else {
                throw err;
              }
            } catch {
              throw err;
            }
          }
        }
      }

      // 2. Create Booking Case
      const createdCase = await api.bookingCases.create({
        providerRouteId: selectedRouteId,
        preferredDateFrom: preferences.preferredDateFrom
          ? new Date(preferences.preferredDateFrom).toISOString()
          : undefined,
        preferredDateTo: preferences.preferredDateTo
          ? new Date(preferences.preferredDateTo).toISOString()
          : undefined,
        preferredTime: computedPreferredTimeString,
        allowGroupSplit: preferences.allowGroupSplit,
      });

      // 3. Attach Applicant as PRIMARY
      await api.bookingCases.addApplicant(createdCase.id, {
        applicantId,
        relation: 'PRIMARY',
        isPrimary: true,
        position: 1,
      });

      // 4. Optionally transition to READY
      if (markReady) {
        await api.bookingCases.markReady(createdCase.id);
      }

      // 5. Navigate to the new case detail page
      router.push(`/bookings/${createdCase.id}`);
    } catch (err: any) {
      setErrorMsg(getLocalizedErrorMessage(err.message, locale));
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
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
                    opacity: isCurrent || isDone ? 1 : 0.4,
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
                      height: '2px',
                      backgroundColor: currentStep > idx + 1 ? '#10b981' : 'rgba(255,255,255,0.1)',
                      margin: '0 16px',
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
          {/* STEP 1: APPOINTMENT DETAILS (VFS GLOBAL STYLE) */}
          {currentStep === 1 && (
            <div id="wizard-step-1" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
                    Appointment Details
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
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '820px' }}>
                  {locale === 'ar'
                    ? 'يرجى تقديم معلومات حول نوع التأشيرة التي ترغب في التقدم للحصول عليها. تذكّر أن فئة الموعد التي يختارها المتقدم الأول سيتم تطبيقها على جميع المتقدمين المضافين لهذا الحجز.'
                    : 'Please provide information about the type of visa you wish to apply for. Be aware that the appointment category Applicant 1 chooses will be applied to each of the applicants added to your appointment booking.'}
                </p>
              </div>

              {routesLoading ? (
                <div style={{ padding: '32px', color: '#94a3b8', textAlign: 'center' }}>
                  {tCommon('loading')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '780px' }}>
                  {/* Dropdown 1: Choose your Destination Country */}
                  <div>
                    <label
                      htmlFor="select-destination-country"
                      style={{
                        display: 'block',
                        fontSize: '0.925rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        marginBottom: '8px',
                      }}
                    >
                      {locale === 'ar' ? 'اختر دولة الوجهة' : 'Choose your Destination Country'}
                      <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        id="select-destination-country"
                        value={destinationCountry}
                        onChange={(e) => handleDestinationChange(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '14px 18px',
                          paddingRight: locale === 'ar' ? '18px' : '44px',
                          paddingLeft: locale === 'ar' ? '44px' : '18px',
                          backgroundColor: '#0c1322',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          borderRadius: '8px',
                          color: destinationCountry ? '#f8fafc' : '#94a3b8',
                          fontSize: '0.95rem',
                          outline: 'none',
                          appearance: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled style={{ backgroundColor: '#0c1322', color: '#64748b' }}>
                          {locale === 'ar' ? 'اختر دولة الوجهة' : 'Choose your Destination Country'}
                        </option>
                        {availableDestinations.map((dest) => (
                          <option key={dest} value={dest} style={{ backgroundColor: '#0c1322', color: '#f8fafc' }}>
                            {getCountryName(dest)} ({dest})
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={18}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          right: locale === 'ar' ? 'auto' : '16px',
                          left: locale === 'ar' ? '16px' : 'auto',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Dropdown 2: Choose your Application Centre */}
                  {destinationCountry && (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <label
                          htmlFor="select-application-centre"
                          style={{
                            fontSize: '0.925rem',
                            fontWeight: 600,
                            color: '#f8fafc',
                          }}
                        >
                          {locale === 'ar' ? 'اختر مركز التقديم' : 'Choose your Application Centre'}
                          <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                        </label>
                        {availableCentres.length > 0 && (
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
                            {availableCentres.length} {locale === 'ar' ? 'مركز (متاح)' : 'Centre(s)'}
                          </span>
                        )}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <select
                          id="select-application-centre"
                          value={applicationCentre}
                          onChange={(e) => handleCentreChange(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            paddingRight: locale === 'ar' ? '18px' : '44px',
                            paddingLeft: locale === 'ar' ? '44px' : '18px',
                            backgroundColor: '#0c1322',
                            border: '1px solid rgba(255, 255, 255, 0.18)',
                            borderRadius: '8px',
                            color: applicationCentre ? '#f8fafc' : '#94a3b8',
                            fontSize: '0.95rem',
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="" disabled style={{ backgroundColor: '#0c1322', color: '#64748b' }}>
                            {locale === 'ar' ? 'اختر مركز التقديم' : 'Choose your Application Centre'}
                          </option>
                          {availableCentres.map((centre) => (
                            <option key={centre} value={centre} style={{ backgroundColor: '#0c1322', color: '#f8fafc' }}>
                              {centre}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={18}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            right: locale === 'ar' ? 'auto' : '16px',
                            left: locale === 'ar' ? '16px' : 'auto',
                            color: '#94a3b8',
                            pointerEvents: 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dropdown 3: Choose your appointment category */}
                  {applicationCentre && (
                    <div>
                      <label
                        htmlFor="select-appointment-category"
                        style={{
                          display: 'block',
                          fontSize: '0.925rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          marginBottom: '8px',
                        }}
                      >
                        {locale === 'ar' ? 'اختر فئة الموعد' : 'Choose your appointment category'}
                        <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <select
                          id="select-appointment-category"
                          value={visaCategory}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            paddingRight: locale === 'ar' ? '18px' : '44px',
                            paddingLeft: locale === 'ar' ? '44px' : '18px',
                            backgroundColor: '#0c1322',
                            border: '1px solid rgba(255, 255, 255, 0.18)',
                            borderRadius: '8px',
                            color: visaCategory ? '#f8fafc' : '#94a3b8',
                            fontSize: '0.95rem',
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="" disabled style={{ backgroundColor: '#0c1322', color: '#64748b' }}>
                            {locale === 'ar' ? 'اختر فئة الموعد' : 'Select your appointment category'}
                          </option>
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat} style={{ backgroundColor: '#0c1322', color: '#f8fafc' }}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={18}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            right: locale === 'ar' ? 'auto' : '16px',
                            left: locale === 'ar' ? '16px' : 'auto',
                            color: '#94a3b8',
                            pointerEvents: 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dropdown 4: Choose your sub-category */}
                  {visaCategory && (
                    <div>
                      <label
                        htmlFor="select-visa-subcategory"
                        style={{
                          display: 'block',
                          fontSize: '0.925rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          marginBottom: '8px',
                        }}
                      >
                        {locale === 'ar' ? 'اختر الفئة الفرعية' : 'Choose your sub-category'}
                        <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <select
                          id="select-visa-subcategory"
                          value={visaSubcategory}
                          onChange={(e) => handleSubcategoryChange(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '14px 18px',
                            paddingRight: locale === 'ar' ? '18px' : '44px',
                            paddingLeft: locale === 'ar' ? '44px' : '18px',
                            backgroundColor: '#0c1322',
                            border: '1px solid rgba(255, 255, 255, 0.18)',
                            borderRadius: '8px',
                            color: visaSubcategory ? '#f8fafc' : '#94a3b8',
                            fontSize: '0.95rem',
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="" disabled style={{ backgroundColor: '#0c1322', color: '#64748b' }}>
                            {locale === 'ar' ? 'اختر الفئة الفرعية' : 'Select your sub-category'}
                          </option>
                          {availableSubcategories.map((sub) => (
                            <option key={sub} value={sub} style={{ backgroundColor: '#0c1322', color: '#f8fafc' }}>
                              {sub}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={18}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            right: locale === 'ar' ? 'auto' : '16px',
                            left: locale === 'ar' ? '16px' : 'auto',
                            color: '#94a3b8',
                            pointerEvents: 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* VFS Slot Notification Banner when selection is complete */}
                  {selectedRouteId && (
                    <div
                      id="vfs-slot-notification-banner"
                      style={{
                        marginTop: '12px',
                        padding: '16px 20px',
                        backgroundColor: 'rgba(6, 78, 59, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '8px',
                        color: '#6ee7b7',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem' }}>
                        <Check size={18} style={{ color: '#10b981' }} />
                        <span>
                          {locale === 'ar'
                            ? 'تم تحديد المسار بنجاح وفقاً لمعايير VFS Global الرسمية.'
                            : 'Route configured successfully according to official VFS Global criteria.'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', paddingLeft: locale === 'ar' ? 0 : '26px', paddingRight: locale === 'ar' ? '26px' : 0 }}>
                        {locale === 'ar'
                          ? 'اضغط "التالي" لمتابعة إدخال بيانات المتقدم وتفضيلات الحجز التلقائي.'
                          : 'Click "Next" to continue with applicant details and automated monitoring preferences.'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PRIMARY APPLICANT */}
          {currentStep === 2 && (
            <div id="wizard-step-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                  {t('step2Title')}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                  {t('step2Desc')}
                </p>
              </div>

              {/* Database Quick Selector Card */}
              <div
                id="card-db-applicant-selector"
                style={{
                  padding: '16px 18px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={16} color="#60a5fa" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#93c5fd' }}>
                      {t('orSelectSaved')}
                    </span>
                  </div>
                  {selectedExistingApplicantId && (
                    <button
                      type="button"
                      id="btn-clear-db-applicant"
                      onClick={handleClearSelectedApplicant}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      <RotateCcw size={12} />
                      <span>{t('clearSelection')}</span>
                    </button>
                  )}
                </div>

                <div>
                  <select
                    id="select-existing-applicant"
                    value={selectedExistingApplicantId || ''}
                    onChange={(e) => handleSelectExistingApplicant(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-input)',
                      border: selectedExistingApplicantId ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">{t('selectExistingApplicant')}</option>
                    {existingApplicants.map((app: any) => (
                      <option key={app.id} value={app.id}>
                        {app.firstName} {app.lastName} • {app.passportMasked || app.passportNumber || 'N/A'} ({app.nationality})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedExistingApplicantId && (
                  <div
                    id="badge-client-data-loaded"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      color: '#6ee7b7',
                      fontSize: '0.8rem',
                    }}
                  >
                    <UserCheck size={14} />
                    <span>
                      {t('clientDataLoaded')}: <strong>{applicantData.firstName} {applicantData.lastName}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {t('fullName')} (First) *
                  </label>
                  <input
                    id="input-applicant-first-name"
                    type="text"
                    required
                    value={applicantData.firstName}
                    onChange={(e) => setApplicantData({ ...applicantData, firstName: e.target.value })}
                    placeholder="Sara"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {t('fullName')} (Last) *
                  </label>
                  <input
                    id="input-applicant-last-name"
                    type="text"
                    required
                    value={applicantData.lastName}
                    onChange={(e) => setApplicantData({ ...applicantData, lastName: e.target.value })}
                    placeholder="Adel"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {t('passportNumber')} *
                    </label>
                    {selectedExistingApplicantId && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: '#60a5fa',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Lock size={10} />
                        {t('savedApplicantBadge')}
                      </span>
                    )}
                  </div>
                  <input
                    id="input-applicant-passport"
                    type="text"
                    dir="ltr"
                    required
                    readOnly={!!selectedExistingApplicantId}
                    value={applicantData.passportNumber}
                    onChange={(e) => setApplicantData({ ...applicantData, passportNumber: e.target.value })}
                    placeholder="A12345678"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      backgroundColor: selectedExistingApplicantId ? 'rgba(30, 41, 59, 0.8)' : 'var(--bg-input)',
                      border: selectedExistingApplicantId ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      direction: 'ltr',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {t('passportExpiry')} *
                  </label>
                  <input
                    id="input-applicant-passport-expiry"
                    type="date"
                    dir="ltr"
                    required
                    value={applicantData.passportExpiry}
                    onChange={(e) => setApplicantData({ ...applicantData, passportExpiry: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      direction: 'ltr',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {t('birthDate')} *
                  </label>
                  <input
                    id="input-applicant-dob"
                    type="date"
                    dir="ltr"
                    required
                    value={applicantData.dateOfBirth}
                    onChange={(e) => setApplicantData({ ...applicantData, dateOfBirth: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      direction: 'ltr',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {t('nationality')} *
                  </label>
                  <input
                    id="input-applicant-nationality"
                    type="text"
                    dir="ltr"
                    value={applicantData.nationality}
                    onChange={(e) => setApplicantData({ ...applicantData, nationality: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                      direction: 'ltr',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREFERENCES & BOT SCHEDULING */}
          {currentStep === 3 && (
            <div id="wizard-step-3" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                  {locale === 'ar' ? 'خيارات وتوقيتات عمل البوت' : 'Appointment & Bot Scheduling'}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px' }}>
                  {locale === 'ar'
                    ? 'حدد النطاق الزمني المستهدف للموعد، وأوقات وساعات عمل البوت، وتوقيت البدء والمدة القصوى للفحص.'
                    : 'Configure preferred slot date range, daily active hours, start time, and monitoring duration.'}
                </p>
              </div>

              {/* 1. Target Appointment Dates */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                    {locale === 'ar' ? 'نطاق الموعد المستهدف (Target Dates)' : 'Target Appointment Dates'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                      {t('preferredDateFrom')} *
                    </label>
                    <input
                      id="input-pref-date-from"
                      type="date"
                      dir="ltr"
                      required
                      value={preferences.preferredDateFrom}
                      onChange={(e) => setPreferences({ ...preferences, preferredDateFrom: e.target.value })}
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
                        direction: 'ltr',
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
                      required
                      value={preferences.preferredDateTo}
                      onChange={(e) => setPreferences({ ...preferences, preferredDateTo: e.target.value })}
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
                        direction: 'ltr',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Daily Bot Active Hours (ساعات عمل البوت اليومية) */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={18} style={{ color: '#818cf8' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                      {locale === 'ar' ? 'أوقات وساعات عمل البوت اليومية (Daily Window)' : 'Daily Bot Active Window'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('24_7')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: scheduleMode === '24_7' ? '#4f46e5' : 'transparent',
                        color: scheduleMode === '24_7' ? '#fff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {locale === 'ar' ? 'طوال اليوم (24/7)' : '24/7 Continuous'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('CUSTOM_HOURS')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: scheduleMode === 'CUSTOM_HOURS' ? '#4f46e5' : 'transparent',
                        color: scheduleMode === 'CUSTOM_HOURS' ? '#fff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {locale === 'ar' ? 'ساعات محددة (من - إلى)' : 'Custom Hours'}
                    </button>
                  </div>
                </div>

                {scheduleMode === 'CUSTOM_HOURS' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                        {locale === 'ar' ? 'من الساعة (Start Time)' : 'From Time'}
                      </label>
                      <input
                        type="time"
                        dir="ltr"
                        value={windowStart}
                        onChange={(e) => setWindowStart(e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 14px',
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '0.9rem',
                          outline: 'none',
                          direction: 'ltr',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                        {locale === 'ar' ? 'إلى الساعة (End Time)' : 'To Time'}
                      </label>
                      <input
                        type="time"
                        dir="ltr"
                        value={windowEnd}
                        onChange={(e) => setWindowEnd(e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px 14px',
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '0.9rem',
                          outline: 'none',
                          direction: 'ltr',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Execution Start Timing (توقيت بدء التشغيل) */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Timer size={18} style={{ color: '#34d399' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                      {locale === 'ar' ? 'توقيت بدء عمل البوت (Start Timing)' : 'Execution Start Timing'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setStartType('IMMEDIATE')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: startType === 'IMMEDIATE' ? '#059669' : 'transparent',
                        color: startType === 'IMMEDIATE' ? '#fff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {locale === 'ar' ? 'البدء فوراً' : 'Immediate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartType('SCHEDULED')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: startType === 'SCHEDULED' ? '#059669' : 'transparent',
                        color: startType === 'SCHEDULED' ? '#fff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {locale === 'ar' ? 'بدء مجدول في وقت محدد' : 'Scheduled Start'}
                    </button>
                  </div>
                </div>

                {startType === 'SCHEDULED' && (
                  <div style={{ paddingTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                      {locale === 'ar' ? 'حدد اليوم والساعة بالدقيقة لبدء العمل:' : 'Select exact date & time to launch:'}
                    </label>
                    <input
                      type="datetime-local"
                      dir="ltr"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '380px',
                        boxSizing: 'border-box',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.9rem',
                        outline: 'none',
                        direction: 'ltr',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 4. Execution Duration (مدة تشغيل البوت القصوى) */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} style={{ color: '#fbbf24' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                      {locale === 'ar' ? 'مدة عمل البوت القصوى (Monitoring Duration)' : 'Monitoring Duration'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '4px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setDurationMode('UNTIL_FOUND')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: durationMode === 'UNTIL_FOUND' ? '#d97706' : 'transparent',
                        color: durationMode === 'UNTIL_FOUND' ? '#fff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {locale === 'ar' ? 'مستمر حتى الحجز' : 'Until Booked'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDurationMode('CUSTOM_DURATION')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: durationMode === 'CUSTOM_DURATION' ? '#d97706' : 'transparent',
                        color: durationMode === 'CUSTOM_DURATION' ? '#fff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {locale === 'ar' ? 'مدة محددة بالساعات' : 'Specific Duration'}
                    </button>
                  </div>
                </div>

                {durationMode === 'CUSTOM_DURATION' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '8px' }}>
                    {[1, 2, 4, 8, 12, 24].map((hours) => {
                      const isSelected = durationHours === hours;
                      return (
                        <button
                          key={hours}
                          type="button"
                          onClick={() => setDurationHours(hours)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: isSelected ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
                            color: isSelected ? '#fcd34d' : '#f8fafc',
                            fontWeight: isSelected ? 600 : 400,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {hours} {locale === 'ar' ? (hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : 'ساعات') : 'Hours'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. Polling Rate (معدل سرعة الفحص) */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                  {locale === 'ar' ? 'معدل وتكرار الفحص (Polling Rate)' : 'Monitoring Frequency'}
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setPollingRate('SAFE')}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: pollingRate === 'SAFE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: pollingRate === 'SAFE' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                      textAlign: 'start',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: pollingRate === 'SAFE' ? '#6ee7b7' : '#f8fafc', fontSize: '0.9rem' }}>
                      {locale === 'ar' ? '🛡️ فحص آمن (كل 3 دقائق)' : '🛡️ Safe Mode (3 min)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                      {locale === 'ar' ? 'موصى به لتفادي أي حظر أو كشف من VFS' : 'Recommended for rate limit safety'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPollingRate('FAST')}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: pollingRate === 'FAST' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: pollingRate === 'FAST' ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                      textAlign: 'start',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: pollingRate === 'FAST' ? '#93c5fd' : '#f8fafc', fontSize: '0.9rem' }}>
                      {locale === 'ar' ? '⚡ فحص سريع (كل 1 دقيقة)' : '⚡ Fast Mode (1 min)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                      {locale === 'ar' ? 'لاقتناص المواعيد اللحظية فور فتحها' : 'High frequency for competitive slots'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPollingRate('RELAXED')}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: pollingRate === 'RELAXED' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: pollingRate === 'RELAXED' ? '2px solid #94a3b8' : '1px solid var(--border-subtle)',
                      textAlign: 'start',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: pollingRate === 'RELAXED' ? '#cbd5e1' : '#f8fafc', fontSize: '0.9rem' }}>
                      {locale === 'ar' ? '☕ فحص هادئ (كل 10 دقائق)' : '☕ Relaxed (10 min)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                      {locale === 'ar' ? 'استهلاك خفيف جداً لموارد الخادم' : 'Minimal server/session footprint'}
                    </div>
                  </button>
                </div>
              </div>

              {/* 6. Live Preview of Bot Plan */}
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Sparkles size={20} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase' }}>
                    {locale === 'ar' ? 'ملخص خطة عمل البوت:' : 'Configured Bot Execution Plan:'}
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 500, marginTop: '2px' }}>
                    {computedPreferredTimeString}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & READINESS */}
          {currentStep === 4 && (
            <div id="wizard-step-4" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
                    {t('step5Title')}
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                    {t('step5Desc')}
                  </p>
                </div>
              </div>

              {/* Summary Review Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                    {t('step1Title')}
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                    {selectedRouteObj
                      ? `${selectedRouteObj.provider?.code || 'VFS'} • ${getCountryName(selectedRouteObj.sourceCountry)} (${selectedRouteObj.sourceCountry}) → ${getCountryName(selectedRouteObj.destinationCountry)} (${selectedRouteObj.destinationCountry}) • ${selectedRouteObj.applicationCentre} (${selectedRouteObj.visaCategory})`
                      : '—'}
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                    {t('primaryApplicant')}
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                    {applicantData.firstName} {applicantData.lastName} • <TechnicalText>{applicantData.passportNumber}</TechnicalText>
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                    {locale === 'ar' ? 'الموعد وجدولة البوت' : t('step4Title')}
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                    <TechnicalText>{preferences.preferredDateFrom}</TechnicalText> → <TechnicalText>{preferences.preferredDateTo}</TechnicalText>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#38bdf8', marginTop: '6px', fontWeight: 500 }}>
                    🤖 {computedPreferredTimeString}
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

            {currentStep < 4 ? (
              <button
                type="button"
                disabled={currentStep === 1 && !selectedRouteId}
                onClick={() => setCurrentStep((s) => s + 1)}
                className="btn-primary"
                id="btn-wizard-next"
                style={{
                  opacity: currentStep === 1 && !selectedRouteId ? 0.5 : 1,
                  cursor: currentStep === 1 && !selectedRouteId ? 'not-allowed' : 'pointer',
                }}
              >
                <span>{tCommon('next')}</span>
                <ChevronRight size={16} className="icon-directional" />
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleFinalSubmit(false)}
                  className="btn-secondary"
                  id="btn-submit-draft"
                >
                  <span>{t('saveDraft')}</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleFinalSubmit(true)}
                  className="btn-success"
                  id="btn-submit-ready"
                >
                  <ShieldCheck size={16} />
                  <span>{submitting ? tCommon('loading') : t('markReady')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

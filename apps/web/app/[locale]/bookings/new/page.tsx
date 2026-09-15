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
  Calendar,
  User,
  MapPin,
  Clock,
  ShieldCheck,
  AlertCircle,
  Sparkles,
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

      // 1. Create Applicant
      let applicantId: string;
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
        throw new Error(err.message || 'Failed to create applicant');
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
        preferredTime: preferences.preferredTime,
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
          {/* STEP 1: ROUTE SELECTION */}
          {currentStep === 1 && (
            <div id="wizard-step-1" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
                  {t('step1Title')}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '4px' }}>
                  {t('step1Desc')}
                </p>
              </div>

              {/* Provider & Source summary chips */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>{t('selectProvider')}:</span>
                  <strong style={{ color: '#93c5fd' }}>VFS Global</strong>
                </div>

                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>{t('sourceCountry')}:</span>
                  <strong style={{ color: '#f8fafc' }}>{getCountryName(sourceCountry)} ({sourceCountry})</strong>
                </div>
              </div>

              {routesLoading ? (
                <div style={{ padding: '24px', color: '#94a3b8' }}>{tCommon('loading')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Dynamic Destination Country Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                      {t('destinationCountry')} *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                      {availableDestinations.map((dest) => {
                        const isSelected = destinationCountry === dest;
                        return (
                          <button
                            key={dest}
                            type="button"
                            id={`destination-option-${dest}`}
                            onClick={() => handleDestinationChange(dest)}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                              border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                              color: isSelected ? '#93c5fd' : '#f8fafc',
                              fontWeight: isSelected ? 600 : 400,
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.15s ease',
                              textAlign: 'start',
                            }}
                          >
                            <span>{getCountryName(dest)}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{dest}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progressive: Application Centre Selection */}
                  {destinationCountry && availableCentres.length > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                        {t('applicationCentre')} *
                      </label>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {availableCentres.map((centre) => {
                          const isSelected = applicationCentre === centre;
                          return (
                            <button
                              key={centre}
                              type="button"
                              id={`centre-option-${centre.replace(/\s+/g, '-').toLowerCase()}`}
                              onClick={() => handleCentreChange(centre)}
                              style={{
                                padding: '10px 16px',
                                borderRadius: '8px',
                                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                                color: isSelected ? '#93c5fd' : '#f8fafc',
                                fontWeight: isSelected ? 600 : 400,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {centre}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Progressive: Visa Category Selection */}
                  {applicationCentre && availableCategories.length > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                        {t('visaCategory')} *
                      </label>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {availableCategories.map((cat) => {
                          const isSelected = visaCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              id={`category-option-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                              onClick={() => handleCategoryChange(cat)}
                              style={{
                                padding: '10px 16px',
                                borderRadius: '8px',
                                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                                color: isSelected ? '#93c5fd' : '#f8fafc',
                                fontWeight: isSelected ? 600 : 400,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Progressive: Visa Subcategory Selection */}
                  {visaCategory && availableSubcategories.length > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                        {t('visaSubcategory')} *
                      </label>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {availableSubcategories.map((sub) => {
                          const isSelected = visaSubcategory === sub;
                          return (
                            <button
                              key={sub}
                              type="button"
                              id={`subcategory-option-${sub.replace(/\s+/g, '-').toLowerCase()}`}
                              onClick={() => handleSubcategoryChange(sub)}
                              style={{
                                padding: '10px 16px',
                                borderRadius: '8px',
                                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                                color: isSelected ? '#93c5fd' : '#f8fafc',
                                fontWeight: isSelected ? 600 : 400,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {sub}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Matching Route Cards */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                      {t('step1Title')}
                    </label>
                    {matchingRoutes.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {matchingRoutes.map((route: any) => {
                          const isSelected = selectedRouteId === route.id;
                          return (
                            <div
                              key={route.id}
                              id={`route-option-${route.id}`}
                              onClick={() => handleSelectRouteDirect(route)}
                              style={{
                                padding: '16px 20px',
                                borderRadius: '10px',
                                backgroundColor: isSelected
                                  ? 'rgba(59, 130, 246, 0.12)'
                                  : 'rgba(255, 255, 255, 0.02)',
                                border: isSelected
                                  ? '2px solid #3b82f6'
                                  : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <span
                                    style={{
                                      backgroundColor: '#1e3a8a',
                                      color: '#93c5fd',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    {route.provider?.code || 'VFS'}
                                  </span>
                                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                                    {getCountryName(route.sourceCountry)} ({route.sourceCountry}) → {getCountryName(route.destinationCountry)} ({route.destinationCountry})
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                  {t('applicationCentre')}: {route.applicationCentre} • {t('visaCategory')}: {route.visaCategory} ({route.visaSubcategory})
                                </span>
                              </div>
                              {isSelected && (
                                <div
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: '#3b82f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                  }}
                                >
                                  <Check size={14} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '20px',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderRadius: '8px',
                          border: '1px dashed var(--border-subtle)',
                          color: '#94a3b8',
                          textAlign: 'center',
                        }}
                      >
                        {t('noRoutesFound')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PRIMARY APPLICANT */}
          {currentStep === 2 && (
            <div id="wizard-step-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
                {t('step2Title')}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                {t('step2Desc')}
              </p>

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
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {t('passportNumber')} *
                  </label>
                  <input
                    id="input-applicant-passport"
                    type="text"
                    dir="ltr"
                    required
                    value={applicantData.passportNumber}
                    onChange={(e) => setApplicantData({ ...applicantData, passportNumber: e.target.value })}
                    placeholder="A12345678"
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

          {/* STEP 3: PREFERENCES */}
          {currentStep === 3 && (
            <div id="wizard-step-3" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
                {t('step4Title')}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                {t('step4Desc')}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {t('preferredDateFrom')}
                  </label>
                  <input
                    id="input-pref-date-from"
                    type="date"
                    dir="ltr"
                    value={preferences.preferredDateFrom}
                    onChange={(e) => setPreferences({ ...preferences, preferredDateFrom: e.target.value })}
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
                    {t('preferredDateTo')}
                  </label>
                  <input
                    id="input-pref-date-to"
                    type="date"
                    dir="ltr"
                    value={preferences.preferredDateTo}
                    onChange={(e) => setPreferences({ ...preferences, preferredDateTo: e.target.value })}
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
                    {t('step4Title')}
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                    <TechnicalText>{preferences.preferredDateFrom}</TechnicalText> → <TechnicalText>{preferences.preferredDateTo}</TechnicalText>
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
                onClick={() => setCurrentStep((s) => s + 1)}
                className="btn-primary"
                id="btn-wizard-next"
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

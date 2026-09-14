'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/api-client';
import { AppShell } from '../../../components/layout/app-shell';
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

export default function NewBookingWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
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

  // Query Routes
  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['provider-routes'],
    queryFn: async () => {
      const list = await api.providerRoutes.list();
      if (list && list.length > 0 && !selectedRouteId) {
        setSelectedRouteId(list[0].id);
      }
      return list;
    },
  });

  const steps = [
    { number: 1, title: 'Route Selection', icon: MapPin },
    { number: 2, title: 'Primary Applicant', icon: User },
    { number: 3, title: 'Preferences', icon: Clock },
    { number: 4, title: 'Review & Readiness', icon: ShieldCheck },
  ];

  async function handleFinalSubmit(markReady: boolean) {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (!selectedRouteId) {
        throw new Error('Please select a valid provider route.');
      }
      if (!applicantData.firstName || !applicantData.lastName || !applicantData.passportNumber) {
        throw new Error('Please fill in all required applicant details and passport number.');
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
        // If already exists, parse existing id if available or propagate
        throw new Error(`Failed to create applicant: ${err.message}`);
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
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setSubmitting(false);
    }
  }

  const selectedRouteObj = routes?.find((r: any) => r.id === selectedRouteId) ?? routes?.[0];

  return (
    <AppShell>
      <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            New Booking Case Wizard
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            Configure destination route, applicant profiles, and scheduling preferences
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
                    {isDone ? <Check size={16} /> : step.number}
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
                      Step {step.number}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
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
            <div id="wizard-step-1" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
                Select Provider Route
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                Choose the appointment route for which you wish to find availability.
              </p>

              {routesLoading ? (
                <div style={{ padding: '24px', color: '#94a3b8' }}>Loading routes...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {routes && routes.length > 0 ? (
                    routes.map((route: any) => {
                      const isSelected = selectedRouteId === route.id;
                      return (
                        <div
                          key={route.id}
                          id={`route-option-${route.id}`}
                          onClick={() => setSelectedRouteId(route.id)}
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
                                {route.sourceCountry} → {route.destinationCountry}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              Centre: {route.applicationCentre} • Category: {route.visaCategory} ({route.visaSubcategory})
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
                    })
                  ) : (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        color: '#94a3b8',
                      }}
                    >
                      Default route (VFS Global Egypt → Greece Cairo) will be used.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PRIMARY APPLICANT */}
          {currentStep === 2 && (
            <div id="wizard-step-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
                Primary Applicant Details
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                Enter the applicant details. Passport numbers are client-side encrypted before storage.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    First Name *
                  </label>
                  <input
                    id="input-applicant-first-name"
                    type="text"
                    required
                    value={applicantData.firstName}
                    onChange={(e) => setApplicantData({ ...applicantData, firstName: e.target.value })}
                    placeholder="e.g. Sara"
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
                    Last Name *
                  </label>
                  <input
                    id="input-applicant-last-name"
                    type="text"
                    required
                    value={applicantData.lastName}
                    onChange={(e) => setApplicantData({ ...applicantData, lastName: e.target.value })}
                    placeholder="e.g. Adel"
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
                    Passport Number *
                  </label>
                  <input
                    id="input-applicant-passport"
                    type="text"
                    required
                    value={applicantData.passportNumber}
                    onChange={(e) => setApplicantData({ ...applicantData, passportNumber: e.target.value })}
                    placeholder="e.g. A12345678"
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
                    Passport Expiry Date *
                  </label>
                  <input
                    id="input-applicant-passport-expiry"
                    type="date"
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
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Date of Birth *
                  </label>
                  <input
                    id="input-applicant-dob"
                    type="date"
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
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Gender *
                  </label>
                  <select
                    id="select-applicant-gender"
                    value={applicantData.gender}
                    onChange={(e) => setApplicantData({ ...applicantData, gender: e.target.value })}
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
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREFERENCES */}
          {currentStep === 3 && (
            <div id="wizard-step-3" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
                Booking & Date Window Preferences
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                Specify the acceptable appointment date window and timing preferences.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Earliest Date
                  </label>
                  <input
                    id="input-pref-date-from"
                    type="date"
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
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Latest Date
                  </label>
                  <input
                    id="input-pref-date-to"
                    type="date"
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
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Preferred Time of Day
                  </label>
                  <select
                    id="select-pref-time"
                    value={preferences.preferredTime}
                    onChange={(e) => setPreferences({ ...preferences, preferredTime: e.target.value })}
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
                  >
                    <option value="MORNING">Morning (08:00 - 12:00)</option>
                    <option value="AFTERNOON">Afternoon (12:00 - 16:00)</option>
                    <option value="ANY">Any available time</option>
                  </select>
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
                    Review & Readiness Check
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                    Review your configuration before saving as draft or arming for automation.
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
                    Route
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                    {selectedRouteObj
                      ? `${selectedRouteObj.provider?.code || 'VFS'} • ${selectedRouteObj.sourceCountry} → ${selectedRouteObj.destinationCountry} (${selectedRouteObj.applicationCentre})`
                      : 'VFS Global • Egypt → Greece (Cairo)'}
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
                    Primary Applicant
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                    {applicantData.firstName} {applicantData.lastName} • Passport: {applicantData.passportNumber}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Expiry: {applicantData.passportExpiry} • DOB: {applicantData.dateOfBirth}
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
                    Target Window
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                    {preferences.preferredDateFrom} → {preferences.preferredDateTo} ({preferences.preferredTime})
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
                <ChevronLeft size={16} />
                <span>Back</span>
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
                <span>Continue</span>
                <ChevronRight size={16} />
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
                  <span>Save as Draft</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleFinalSubmit(true)}
                  className="btn-success"
                  id="btn-submit-ready"
                >
                  <ShieldCheck size={16} />
                  <span>{submitting ? 'Saving...' : 'Save & Mark Ready'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

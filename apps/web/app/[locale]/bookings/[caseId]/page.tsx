'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '../../../../i18n/navigation';
import { api } from '../../../../lib/api/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { getStatusConfig } from '../../../../lib/formatters/status';
import { formatDate, formatDateTime, formatRelativeTime } from '../../../../lib/formatters/dates';
import { formatCurrency } from '../../../../lib/formatters/numbers';
import { TechnicalText } from '../../../../components/ui/technical-text';
import { BookingCaseStatus } from '@visaflow/shared-types';
import {
  Play,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Users,
  ExternalLink,
  RefreshCw,
  Send,
  Calendar,
  Lock,
  Cpu,
  Activity,
  ArrowLeft,
} from 'lucide-react';

export default function LocalizedCaseDetailPage() {
  const params = useParams();
  const caseId = params?.caseId as string;
  const locale = useLocale();
  const t = useTranslations('caseDetail');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();

  // Challenge resolution form state
  const [challengeInput, setChallengeInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const {
    data: caseDetail,
    isLoading,
    error,
    refetch: refetchCase,
  } = useQuery({
    queryKey: ['case-detail', caseId],
    queryFn: () => api.operations.getCaseDetail(caseId),
    enabled: !!caseId,
    refetchInterval: 5000,
  });

  const { data: timeline, refetch: refetchTimeline } = useQuery({
    queryKey: ['case-timeline', caseId],
    queryFn: () => api.operations.getCaseTimeline(caseId),
    enabled: !!caseId,
    refetchInterval: 5000,
  });

  // Mutations
  const markReadyMutation = useMutation({
    mutationFn: () => api.bookingCases.markReady(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-timeline', caseId] });
      setActionError(null);
    },
    onError: (err: any) => setActionError(err.message),
  });

  const startAutomationMutation = useMutation({
    mutationFn: () => api.orchestrator.startAutomation(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-timeline', caseId] });
      setActionError(null);
    },
    onError: (err: any) => setActionError(err.message),
  });

  const resumeMutation = useMutation({
    mutationFn: (solutionData: any) =>
      api.orchestrator.resumeAutomation(caseId, solutionData),
    onSuccess: () => {
      setChallengeInput('');
      queryClient.invalidateQueries({ queryKey: ['case-detail', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-timeline', caseId] });
      setActionError(null);
    },
    onError: (err: any) => setActionError(err.message),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {tCommon('loadingDetails')}
        </div>
      </AppShell>
    );
  }

  if (error || !caseDetail) {
    return (
      <AppShell>
        <div style={{ padding: '40px', textAlign: 'center', color: '#f87171' }}>
          {tCommon('errorLoadingDetails')}: {error ? (error as Error).message : tCommon('notFound')}
        </div>
      </AppShell>
    );
  }

  const statusConfig = getStatusConfig(caseDetail.status);
  const localizedStatusLabel = tStatus.has(caseDetail.status)
    ? tStatus(caseDetail.status as any)
    : statusConfig.label;

  const isDraft = caseDetail.status === BookingCaseStatus.DRAFT;
  const isReady = caseDetail.status === BookingCaseStatus.READY;
  const isHumanAction = caseDetail.status === BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED;
  const isPaymentRequired = caseDetail.status === BookingCaseStatus.PAYMENT_REQUIRED;
  const isConfirmed = caseDetail.status === BookingCaseStatus.CONFIRMED;

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Back navigation */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link
            href="/bookings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} className="icon-directional" />
            <span>{t('back')}</span>
          </Link>
        </div>

        {/* Top Header Card */}
        <div
          id="case-header-card"
          className="glass-card"
          style={{
            padding: '24px 28px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h1 id="case-detail-number" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                <TechnicalText>{caseDetail.caseNumber}</TechnicalText>
              </h1>
              <span id="case-detail-status-badge" className={`badge ${statusConfig.badgeClass}`}>
                {localizedStatusLabel}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{caseDetail.provider.code}</span>
              <span>•</span>
              <span>
                {caseDetail.provider.sourceCountry} → {caseDetail.provider.destinationCountry} (
                {caseDetail.provider.applicationCentre})
              </span>
              <span>•</span>
              <span>
                {t('category')}: {caseDetail.provider.visaCategory}
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                refetchCase();
                refetchTimeline();
              }}
              className="btn-secondary"
              id="btn-refresh-case-detail"
              style={{ padding: '8px 12px' }}
              aria-label={t('refresh')}
            >
              <RefreshCw size={14} />
            </button>

            {isDraft && (
              <button
                id="btn-case-action-ready"
                onClick={() => markReadyMutation.mutate()}
                disabled={markReadyMutation.isPending}
                className="btn-primary"
              >
                <ShieldCheck size={16} />
                <span>{markReadyMutation.isPending ? t('verifying') : t('markAsReady')}</span>
              </button>
            )}

            {isReady && (
              <button
                id="btn-case-action-start"
                onClick={() => startAutomationMutation.mutate()}
                disabled={startAutomationMutation.isPending}
                className="btn-success"
              >
                <Play size={16} className="icon-directional" />
                <span>{startAutomationMutation.isPending ? t('starting') : t('startAutomation')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div
            id="case-action-error"
            style={{
              padding: '12px 18px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.875rem',
            }}
          >
            {actionError}
          </div>
        )}

        {/* Confirmed Booking Banner */}
        {(isConfirmed || caseDetail.appointment) && (
          <div
            id="confirmed-booking-banner"
            className="glass-card"
            style={{
              padding: '24px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#6ee7b7', margin: 0 }}>
                  {t('bookingConfirmedTitle')}
                </h3>
                <span style={{ fontSize: '0.875rem', color: '#a7f3d0' }}>
                  {t('bookingConfirmedDesc')}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  {t('reference')}
                </span>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  <TechnicalText>
                    {caseDetail.appointment?.confirmationCode || caseDetail.caseNumber}
                  </TechnicalText>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  {t('appointmentDate')}
                </span>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                  {caseDetail.appointment?.appointmentDate
                    ? formatDate(caseDetail.appointment.appointmentDate, locale)
                    : formatDate(new Date().toISOString(), locale)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  {t('appointmentTime')}
                </span>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                  <TechnicalText>
                    {caseDetail.appointment?.appointmentTime || caseDetail.preferredTime || '09:30 AM'}
                  </TechnicalText>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  {t('centre')}
                </span>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                  {caseDetail.appointment?.centre || caseDetail.provider.applicationCentre}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  {t('applicantsTitle')}
                </span>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                  {caseDetail.applicants.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Human Challenge Urgent Action Card */}
        {isHumanAction && (
          <div
            id="human-challenge-action-card"
            className="glass-card"
            style={{
              padding: '24px',
              backgroundColor: 'rgba(249, 115, 22, 0.08)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(249, 115, 22, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f97316',
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fed7aa', margin: 0 }}>
                  {t('humanVerificationTitle')}
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#fdba74' }}>
                  {t('humanVerificationDesc')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', maxWidth: '600px' }}>
              <input
                id="input-challenge-solution"
                type="text"
                dir="ltr"
                placeholder={t('enterChallengeSolution')}
                value={challengeInput}
                onChange={(e) => setChallengeInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
              <button
                id="btn-submit-challenge-solution"
                onClick={() =>
                  resumeMutation.mutate({
                    solution: challengeInput || 'SOLVED_BY_OPERATOR',
                  })
                }
                disabled={resumeMutation.isPending}
                className="btn-primary"
                style={{ backgroundColor: '#ea580c' }}
              >
                <Send size={15} className="icon-directional" />
                <span>{resumeMutation.isPending ? t('submitting') : t('submitAndResume')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Payment Required Handoff Card */}
        {isPaymentRequired && (
          <div
            id="payment-handoff-action-card"
            className="glass-card"
            style={{
              padding: '24px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b',
                }}
              >
                <CreditCard size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fde68a', margin: 0 }}>
                  {t('paymentRequiredTitle')}
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#fef3c7' }}>
                  {t('paymentRequiredDesc')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
              {caseDetail.paymentHandoff?.amount && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    {t('amountDue')}
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                    {formatCurrency(
                      caseDetail.paymentHandoff.amount,
                      caseDetail.paymentHandoff.currency || 'USD',
                      locale
                    )}
                  </div>
                </div>
              )}

              {caseDetail.paymentHandoff?.safePaymentPath && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    {t('gatewayLink')}
                  </span>
                  <div>
                    <a
                      href={caseDetail.paymentHandoff.safePaymentPath}
                      target="_blank"
                      rel="noreferrer"
                      id="link-payment-gateway"
                      dir="ltr"
                      style={{
                        color: '#60a5fa',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.875rem',
                        textDecoration: 'underline',
                      }}
                    >
                      <span>{t('openPaymentLink')}</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )}

              <button
                id="btn-confirm-payment-complete"
                onClick={() =>
                  resumeMutation.mutate({
                    paymentCompleted: true,
                  })
                }
                disabled={resumeMutation.isPending}
                className="btn-success"
                style={{ marginInlineStart: 'auto' }}
              >
                <CheckCircle2 size={16} />
                <span>{t('confirmPaymentComplete')}</span>
              </button>
            </div>
          </div>
        )}

        {/* 2-Column Grid: Left (Applicants & Config) / Right (Live Automation & Timeline) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Applicants Card */}
            <div id="case-applicants-card" className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Users size={18} color="#3b82f6" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  {t('applicantsTitle')} ({caseDetail.applicants.length})
                </h3>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table
                  id="case-applicants-table"
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'start',
                    fontSize: '0.875rem',
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 500, textAlign: 'start' }}>{t('name')}</th>
                      <th style={{ padding: '8px 10px', fontWeight: 500, textAlign: 'start' }}>{t('relation')}</th>
                      <th style={{ padding: '8px 10px', fontWeight: 500, textAlign: 'start' }}>{t('passportMasked')}</th>
                      <th style={{ padding: '8px 10px', fontWeight: 500, textAlign: 'start' }}>{t('nationality')}</th>
                      <th style={{ padding: '8px 10px', fontWeight: 500, textAlign: 'start' }}>{t('expiry')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseDetail.applicants.map((app) => (
                      <tr
                        key={app.id}
                        id={`applicant-row-${app.id}`}
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}
                      >
                        <td style={{ padding: '12px 10px', fontWeight: 600, color: '#f8fafc' }}>
                          {app.firstName} {app.lastName}
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
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{app.relation}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: '#cbd5e1',
                              letterSpacing: '0.05em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Lock size={11} />
                            <TechnicalText>{app.passportMasked}</TechnicalText>
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{app.nationality}</td>
                        <td style={{ padding: '12px 10px', color: '#64748b' }}>
                          {formatDate(app.passportExpiry, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Target Window & Preferences Card */}
            <div id="case-preferences-card" className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Calendar size={18} color="#0ea5e9" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  {t('schedulingPreferences')}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    {t('targetWindow')}
                  </span>
                  <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 500, marginTop: '2px' }}>
                    {caseDetail.preferredDateFrom ? formatDate(caseDetail.preferredDateFrom, locale) : tCommon('any')} →{' '}
                    {caseDetail.preferredDateTo ? formatDate(caseDetail.preferredDateTo, locale) : tCommon('any')}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    {t('timePreference')}
                  </span>
                  <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 500, marginTop: '2px' }}>
                    {caseDetail.preferredTime || tCommon('anyTime')}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    {t('groupSplitAllowed')}
                  </span>
                  <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 500, marginTop: '2px' }}>
                    {caseDetail.allowGroupSplit ? t('groupSplitAllowedYes') : t('groupSplitAllowedNo')}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    {t('providerAccount')}
                  </span>
                  <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 500, marginTop: '2px' }}>
                    {caseDetail.providerAccount?.label || caseDetail.providerAccount?.username || t('autoAllocated')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Live Automation Session Card */}
            <div id="case-automation-session-card" className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Cpu size={18} color="#8b5cf6" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  {t('automationSession')}
                </h3>
              </div>

              {caseDetail.automationSession ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('sessionStatus')}</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(139, 92, 246, 0.15)',
                        color: '#c4b5fd',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      <TechnicalText>{caseDetail.automationSession.status}</TechnicalText>
                    </span>
                  </div>

                  {caseDetail.automationSession.currentPath && (
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('currentStep')}</span>
                      <div style={{ fontSize: '0.875rem', color: '#f8fafc', fontWeight: 500 }}>
                        <TechnicalText>{caseDetail.automationSession.currentPath}</TechnicalText>
                      </div>
                    </div>
                  )}

                  {caseDetail.automationSession.humanActionType && (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'rgba(249, 115, 22, 0.12)',
                        border: '1px solid rgba(249, 115, 22, 0.3)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: '#fdba74',
                      }}
                    >
                      {t('activeChallenge')} {caseDetail.automationSession.humanActionType}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                  {t('noActiveSession', { status: localizedStatusLabel })}
                </div>
              )}
            </div>

            {/* Real-Time Timeline Feed Card */}
            <div id="case-timeline-card" className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Activity size={18} color="#10b981" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  {t('timelineTitle')}
                </h3>
              </div>

              {timeline && timeline.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '450px', overflowY: 'auto' }}>
                  {timeline.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      id={`timeline-item-${item.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor:
                            item.toStatus === BookingCaseStatus.CONFIRMED
                              ? '#10b981'
                              : item.toStatus === BookingCaseStatus.FAILED
                              ? '#ef4444'
                              : '#3b82f6',
                          marginTop: '5px',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
                          {item.title}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        )}
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                          {formatDateTime(item.timestamp, locale)} ({formatRelativeTime(item.timestamp, locale)})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                  {t('noTimelineEvents')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

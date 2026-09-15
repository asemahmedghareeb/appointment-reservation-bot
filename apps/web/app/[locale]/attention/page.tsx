'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '../../../i18n/navigation';
import { api } from '../../../lib/api/api-client';
import { AppShell } from '../../../components/layout/app-shell';
import { getStatusConfig } from '../../../lib/formatters/status';
import { formatAgeSeconds } from '../../../lib/formatters/dates';
import { TechnicalText } from '../../../components/ui/technical-text';
import {
  AlertTriangle,
  Clock,
  ArrowUpRight,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';

export default function LocalizedAttentionQueuePage() {
  const locale = useLocale();
  const t = useTranslations('attention');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');

  const { data: attentionCases, isLoading, refetch } = useQuery({
    queryKey: ['attention-list'],
    queryFn: () => api.operations.getAttentionList(50),
    refetchInterval: 5000,
  });

  const cases = attentionCases ?? [];

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {t('title')}
              </h1>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
              {t('subtitle')}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary"
            id="btn-refresh-attention"
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            <RefreshCw size={14} />
            <span>{t('refresh')}</span>
          </button>
        </div>

        {/* Attention Table */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('loading')}
            </div>
          ) : cases.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle size={40} color="#10b981" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '4px' }}>
                {t('queueClearTitle')}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {t('queueClearDesc')}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                id="attention-cases-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'start',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('colCaseNumber')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('colProviderCentre')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('colStatus')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('colReason')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('colWaitingTime')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'end' }}>{t('colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => {
                    const statusConfig = getStatusConfig(c.currentStatus);
                    const localizedStatusLabel = tStatus.has(c.currentStatus)
                      ? tStatus(c.currentStatus as any)
                      : statusConfig.label;

                    return (
                      <tr
                        key={c.caseId}
                        id={`attention-item-${c.caseId}`}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '16px 20px', fontWeight: 600 }}>
                          <Link
                            href={`/bookings/${c.caseId}`}
                            id={`link-attention-case-${c.caseId}`}
                            style={{ color: '#60a5fa', textDecoration: 'none' }}
                          >
                            <TechnicalText>{c.caseNumber}</TechnicalText>
                          </Link>
                        </td>
                        <td style={{ padding: '16px 20px', color: '#cbd5e1' }}>
                          <TechnicalText>{c.provider}</TechnicalText> • {c.destination} ({c.centre})
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span className={`badge ${statusConfig.badgeClass}`}>
                            {localizedStatusLabel}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', color: '#f8fafc', maxWidth: '350px' }}>
                          <div>{c.reason}</div>
                          {c.humanActionType && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#f97316',
                                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginTop: '4px',
                                display: 'inline-block',
                              }}
                            >
                              {t('challengeType')} {c.humanActionType}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#f59e0b', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={14} />
                            <span>{formatAgeSeconds(c.ageSeconds, locale)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'end' }}>
                          <Link
                            href={`/bookings/${c.caseId}`}
                            className="btn-primary"
                            id={`btn-open-attention-case-${c.caseId}`}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <span>{t('resolveNow')}</span>
                            <ArrowUpRight size={14} className="icon-directional" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

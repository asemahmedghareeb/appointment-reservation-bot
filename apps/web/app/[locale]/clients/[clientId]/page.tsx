'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '../../../../i18n/navigation';
import { api } from '../../../../lib/api/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { TechnicalText } from '../../../../components/ui/technical-text';
import { getStatusConfig } from '../../../../lib/formatters/status';
import { formatDate } from '../../../../lib/formatters/dates';
import {
  Users,
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  ArrowUpRight,
} from 'lucide-react';

export default function LocalizedClientDetailPage() {
  const params = useParams();
  const clientId = params?.clientId as string;
  const locale = useLocale();
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');

  const { data: client, isLoading, error } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.clients.getById(clientId),
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <AppShell>
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {tCommon('loading')}
        </div>
      </AppShell>
    );
  }

  if (error || !client) {
    return (
      <AppShell>
        <div style={{ padding: '40px', textAlign: 'center', color: '#f87171' }}>
          {error ? (error as Error).message : tCommon('notFound')}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Back Link */}
        <div>
          <Link
            href="/clients"
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
            <span>{tCommon('back')}</span>
          </Link>
        </div>

        {/* Client Profile Card */}
        <div className="glass-card" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {client.name}
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                {t('clientDetailSubtitle')}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                {t('email')}
              </span>
              <div style={{ fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px' }}>
                {client.email ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} color="#60a5fa" />
                    <TechnicalText>{client.email}</TechnicalText>
                  </div>
                ) : (
                  tCommon('notAvailable')
                )}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                {t('phone')}
              </span>
              <div style={{ fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px' }}>
                {client.phone ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} color="#34d399" />
                    <TechnicalText>{client.phone}</TechnicalText>
                  </div>
                ) : (
                  tCommon('notAvailable')
                )}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                {tCommon('created')}
              </span>
              <div style={{ fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px' }}>
                {formatDate(client.createdAt, locale)}
              </div>
            </div>
          </div>
        </div>

        {/* Associated Booking Cases */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Briefcase size={18} color="#60a5fa" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              {t('associatedCases')} ({client.bookingCases?.length || 0})
            </h3>
          </div>

          {client.bookingCases && client.bookingCases.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'start' }}>Case Number</th>
                    <th style={{ padding: '8px 12px', textAlign: 'start' }}>Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'start' }}>Created</th>
                    <th style={{ padding: '8px 12px', textAlign: 'end' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {client.bookingCases.map((bc: any) => {
                    const statusConfig = getStatusConfig(bc.status);
                    const localizedStatus = tStatus.has(bc.status) ? tStatus(bc.status as any) : statusConfig.label;
                    return (
                      <tr key={bc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          <Link href={`/bookings/${bc.id}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>
                            <TechnicalText>{bc.caseNumber}</TechnicalText>
                          </Link>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className={`badge ${statusConfig.badgeClass}`}>{localizedStatus}</span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          {formatDate(bc.createdAt, locale)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'end' }}>
                          <Link
                            href={`/bookings/${bc.id}`}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>{tCommon('viewDetails')}</span>
                            <ArrowUpRight size={13} className="icon-directional" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {t('noAssociatedCases')}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

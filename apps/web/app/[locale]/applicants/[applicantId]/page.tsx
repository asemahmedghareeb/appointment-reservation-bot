'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '../../../../i18n/navigation';
import { api } from '../../../../lib/api/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import { TechnicalText } from '../../../../components/ui/technical-text';
import { formatDate } from '../../../../lib/formatters/dates';
import {
  Users,
  ArrowLeft,
  Lock,
  Globe,
  Calendar,
} from 'lucide-react';

export default function LocalizedApplicantDetailPage() {
  const params = useParams();
  const applicantId = params?.applicantId as string;
  const locale = useLocale();
  const t = useTranslations('applicants');
  const tCommon = useTranslations('common');

  const { data: applicant, isLoading, error } = useQuery({
    queryKey: ['applicant', applicantId],
    queryFn: () => api.applicants.getById(applicantId),
    enabled: !!applicantId,
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

  if (error || !applicant) {
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
            href="/applicants"
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

        {/* Applicant Profile Card */}
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
                {applicant.firstName} {applicant.lastName}
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                {t('applicantDetailSubtitle')}
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
                {t('passportNumber')}
              </span>
              <div style={{ fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color: '#cbd5e1',
                    letterSpacing: '0.05em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Lock size={12} />
                  <TechnicalText>{applicant.passportMasked || applicant.passportNumber}</TechnicalText>
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                {t('nationality')}
              </span>
              <div style={{ fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={14} color="#60a5fa" />
                <TechnicalText>{applicant.nationality}</TechnicalText>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                {t('passportExpiry')}
              </span>
              <div style={{ fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="#34d399" />
                <span>{formatDate(applicant.passportExpiry, locale)}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                {t('birthDate')}
              </span>
              <div style={{ fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="#94a3b8" />
                <span>{formatDate(applicant.dateOfBirth, locale)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

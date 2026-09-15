'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '../../../i18n/navigation';
import { api } from '../../../lib/api/api-client';
import { AppShell } from '../../../components/layout/app-shell';
import { TechnicalText } from '../../../components/ui/technical-text';
import { formatDate } from '../../../lib/formatters/dates';
import {
  Users,
  Plus,
  Search,
  Lock,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

export default function LocalizedApplicantsPage() {
  const locale = useLocale();
  const t = useTranslations('applicants');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('MALE');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nationality, setNationality] = useState('EGY');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['applicants', { search }],
    queryFn: () => api.applicants.list({ search: search || undefined, limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (newApplicant: any) => api.applicants.create(newApplicant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
      setShowCreateModal(false);
      setFirstName('');
      setLastName('');
      setPassportNumber('');
      setPassportExpiry('');
      setDateOfBirth('');
      setFormError(null);
    },
    onError: (err: any) => setFormError(err.message),
  });

  const applicants = data?.items ?? [];

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
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3b82f6',
                }}
              >
                <Users size={18} />
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
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            id="btn-add-applicant"
          >
            <Plus size={16} />
            <span>{t('addApplicant')}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="glass-card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              id="input-search-applicants"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {tCommon('loading')}
            </div>
          ) : applicants.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <Users size={36} color="#475569" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '4px' }}>
                {t('emptyTitle')}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {t('emptyDesc')}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                id="applicants-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'start',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('fullName')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('passportNumber')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('nationality')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('passportExpiry')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'end' }}>{tCommon('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((a: any) => (
                    <tr
                      key={a.id}
                      id={`applicant-row-${a.id}`}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#f8fafc' }}>
                        <Link
                          href={`/applicants/${a.id}`}
                          id={`link-applicant-${a.id}`}
                          style={{ color: '#60a5fa', textDecoration: 'none' }}
                        >
                          {a.firstName} {a.lastName}
                        </Link>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
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
                          <Lock size={11} />
                          <TechnicalText>{a.passportMasked || a.passportNumber}</TechnicalText>
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                        <TechnicalText>{a.nationality}</TechnicalText>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                        {formatDate(a.passportExpiry, locale)}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'end' }}>
                        <Link
                          href={`/applicants/${a.id}`}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>{tCommon('viewDetails')}</span>
                          <ArrowUpRight size={13} className="icon-directional" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Applicant Modal */}
        {showCreateModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '16px',
            }}
          >
            <div
              className="glass-card"
              style={{
                width: '100%',
                maxWidth: '520px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {t('createApplicantModal')}
              </h2>

              {formError && (
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderRadius: '6px', fontSize: '0.85rem' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {t('firstName')} *
                  </label>
                  <input
                    id="input-applicant-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
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
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {t('lastName')} *
                  </label>
                  <input
                    id="input-applicant-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
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
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {t('passportNumber')} *
                  </label>
                  <input
                    id="input-applicant-passport"
                    type="text"
                    dir="ltr"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
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
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {t('nationality')} *
                  </label>
                  <input
                    id="input-applicant-nationality"
                    type="text"
                    dir="ltr"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
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
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {t('passportExpiry')} *
                  </label>
                  <input
                    id="input-applicant-expiry"
                    type="date"
                    dir="ltr"
                    value={passportExpiry}
                    onChange={(e) => setPassportExpiry(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
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
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {t('birthDate')} *
                  </label>
                  <input
                    id="input-applicant-dob"
                    type="date"
                    dir="ltr"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  disabled={createMutation.isPending}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    createMutation.mutate({
                      firstName,
                      lastName,
                      gender,
                      dateOfBirth,
                      nationality,
                      passportNumber,
                      passportExpiry,
                    })
                  }
                  disabled={!firstName.trim() || !lastName.trim() || !passportNumber.trim() || createMutation.isPending}
                  className="btn-primary"
                  id="btn-submit-applicant"
                >
                  {createMutation.isPending ? t('saving') : tCommon('save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

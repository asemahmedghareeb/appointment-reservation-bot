'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '../../../i18n/navigation';
import { api } from '../../../lib/api/api-client';
import { AppShell } from '../../../components/layout/app-shell';
import { TechnicalText } from '../../../components/ui/technical-text';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  ArrowUpRight,
  Briefcase,
} from 'lucide-react';

export default function LocalizedClientsPage() {
  const locale = useLocale();
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search }],
    queryFn: () => api.clients.list({ search: search || undefined, limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (newClient: { name: string; email?: string | undefined; phone?: string | undefined }) =>
      api.clients.create(newClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowCreateModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setFormError(null);
    },
    onError: (err: any) => setFormError(err.message),
  });

  const clients = data?.items ?? [];

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
            id="btn-add-client"
          >
            <Plus size={16} />
            <span>{t('addClient')}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="glass-card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              id="input-search-clients"
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
          ) : clients.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <Briefcase size={36} color="#475569" style={{ marginBottom: '12px' }} />
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
                id="clients-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'start',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('name')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('email')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'start' }}>{t('phone')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'end' }}>{tCommon('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c: any) => (
                    <tr
                      key={c.id}
                      id={`client-row-${c.id}`}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#f8fafc' }}>
                        <Link
                          href={`/clients/${c.id}`}
                          id={`link-client-${c.id}`}
                          style={{ color: '#60a5fa', textDecoration: 'none' }}
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                        {c.email ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={13} />
                            <TechnicalText>{c.email}</TechnicalText>
                          </div>
                        ) : (
                          tCommon('notAvailable')
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                        {c.phone ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={13} />
                            <TechnicalText>{c.phone}</TechnicalText>
                          </div>
                        ) : (
                          tCommon('notAvailable')
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'end' }}>
                        <Link
                          href={`/clients/${c.id}`}
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

        {/* Create Client Modal */}
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
                maxWidth: '480px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {t('createClientModal')}
              </h2>

              {formError && (
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderRadius: '6px', fontSize: '0.85rem' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {t('name')} *
                  </label>
                  <input
                    id="input-client-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    {t('email')}
                  </label>
                  <input
                    id="input-client-email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    {t('phone')}
                  </label>
                  <input
                    id="input-client-phone"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
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
                  onClick={() => createMutation.mutate({ name, email: email || undefined, phone: phone || undefined })}
                  disabled={!name.trim() || createMutation.isPending}
                  className="btn-primary"
                  id="btn-submit-client"
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

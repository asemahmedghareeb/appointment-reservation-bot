'use client';

import React, { useState } from 'react';
import { Link } from '../../../i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/api-client';
import { AppShell } from '../../../components/layout/app-shell';
import { getStatusConfig } from '../../../lib/formatters/status';
import { formatDate } from '../../../lib/formatters/dates';
import { formatNumber } from '../../../lib/formatters/numbers';
import { TechnicalText } from '../../../components/ui/technical-text';
import { BookingCaseStatus } from '@visaflow/shared-types';
import {
  Search,
  Plus,
  Filter,
  Calendar,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  Trash2,
} from 'lucide-react';

export default function LocalizedBookingsListPage() {
  const locale = useLocale();
  const t = useTranslations('bookings');
  const tCommon = useTranslations('common');

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['booking-cases', { status: statusFilter, search: searchTerm, page }],
    queryFn: () =>
      api.bookingCases.list({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
        page,
        limit: 20,
      }),
  });

  const cases = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.bookingCases.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setDeletingId(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete case');
      setDeletingId(null);
    },
  });

  const handleDelete = (id: string, caseNumber: string) => {
    const confirmMessage =
      locale === 'ar'
        ? `هل أنت متأكد من حذف الحجز ${caseNumber} نهائياً؟`
        : `Are you sure you want to permanently delete booking ${caseNumber}?`;
    if (window.confirm(confirmMessage)) {
      setDeletingId(id);
      deleteMutation.mutate(id);
    }
  };

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header with Title and Create Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
              {t('title')}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              {t('subtitle')}
            </p>
          </div>
          <Link
            href="/bookings/new"
            id="btn-create-booking-case"
            className="btn-primary"
          >
            <Plus size={16} />
            <span>{t('newBooking')}</span>
          </Link>
        </div>

        {/* Filter and Search Bar */}
        <div
          className="glass-card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 12px',
                flex: 1,
                maxWidth: '400px',
              }}
            >
              <Search size={16} color="#94a3b8" />
              <input
                id="input-search-cases"
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '0.875rem',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>

            {/* Status Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="#94a3b8" />
              <select
                id="select-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '0.875rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">{t('allStatuses')}</option>
                {Object.values(BookingCaseStatus).map((st) => (
                  <option key={st} value={st}>
                    {getStatusConfig(st, locale).label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {t('showing')} {formatNumber(cases.length, locale)} {t('of')}{' '}
              {formatNumber(total, locale)} {t('results')}
            </span>
            <button
              onClick={() => refetch()}
              id="btn-refresh-cases"
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Cases Table */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
              {tCommon('loading')}
            </div>
          ) : cases.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <FolderOpen size={36} color="#475569" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '4px' }}>
                {t('emptyTitle')}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '16px' }}>
                {t('emptyDesc')}
              </p>
              <Link href="/bookings/new" className="btn-primary">
                <Plus size={16} />
                <span>{t('newBooking')}</span>
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                id="booking-cases-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'start',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>{t('caseId')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>{t('status')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>{t('route')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>{t('applicants')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>{t('route')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>{tCommon('created')}</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'end' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c: any) => {
                    const statusConfig = getStatusConfig(c.status, locale);
                    const applicantsCount = c.bookingApplicants?.length || (c._count?.bookingApplicants ?? 1);
                    return (
                      <tr
                        key={c.id}
                        id={`case-row-${c.id}`}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '16px 20px', fontWeight: 600 }}>
                          <Link
                            href={`/bookings/${c.id}`}
                            id={`link-case-${c.id}`}
                            style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <TechnicalText>{c.caseNumber}</TechnicalText>
                          </Link>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span className={`badge ${statusConfig.badgeClass}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', color: '#cbd5e1' }}>
                          {c.providerRoute
                            ? `${c.providerRoute.provider?.code || 'VFS'} • ${c.providerRoute.destinationCountry} (${c.providerRoute.applicationCentre})`
                            : '—'}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                          {formatNumber(applicantsCount, locale)} {t('applicants')}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                          {c.preferredDateFrom ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={13} color="#64748b" />
                              {formatDate(c.preferredDateFrom, locale)} → {formatDate(c.preferredDateTo, locale)}
                            </span>
                          ) : (
                            tCommon('notAvailable')
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.8rem' }}>
                          {formatDate(c.createdAt, locale)}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'end' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <Link
                              href={`/bookings/${c.id}`}
                              className="btn-secondary"
                              id={`btn-view-case-${c.id}`}
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            >
                              <span>{t('viewCase')}</span>
                              <ChevronRight size={14} className="icon-directional" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id, c.caseNumber)}
                              disabled={deletingId === c.id}
                              id={`btn-delete-case-${c.id}`}
                              title={locale === 'ar' ? 'حذف الحجز' : 'Delete Booking'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#f87171',
                                cursor: deletingId === c.id ? 'not-allowed' : 'pointer',
                                opacity: deletingId === c.id ? 0.5 : 1,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <Trash2 size={13} />
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

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary"
                id="btn-prev-page"
                style={{ padding: '6px 12px', fontSize: '0.75rem', opacity: page <= 1 ? 0.4 : 1 }}
              >
                {t('paginationPrev')}
              </button>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {formatNumber(page, locale)} / {formatNumber(totalPages, locale)}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-secondary"
                id="btn-next-page"
                style={{ padding: '6px 12px', fontSize: '0.75rem', opacity: page >= totalPages ? 0.4 : 1 }}
              >
                {t('paginationNext')}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

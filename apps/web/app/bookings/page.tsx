'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/api-client';
import { AppShell } from '../../components/layout/app-shell';
import { getStatusConfig } from '../../lib/formatters/status';
import { formatDate } from '../../lib/formatters/dates';
import { BookingCaseStatus } from '@visaflow/shared-types';
import {
  Search,
  Plus,
  Filter,
  Calendar,
  ChevronRight,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

export default function BookingsListPage() {
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

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header with Title and Create Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
              Booking Cases
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              Manage visa appointment reservation workflows and automation states
            </p>
          </div>
          <Link
            href="/bookings/new"
            id="btn-create-booking-case"
            className="btn-primary"
          >
            <Plus size={16} />
            <span>New Booking Case</span>
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
                placeholder="Search case number or applicant..."
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
                <option value="">All Statuses</option>
                {Object.values(BookingCaseStatus).map((st) => (
                  <option key={st} value={st}>
                    {getStatusConfig(st).label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Showing {cases.length} of {total} cases
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
              Loading booking cases...
            </div>
          ) : cases.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <FolderOpen size={36} color="#475569" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '4px' }}>
                No booking cases found
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '16px' }}>
                {searchTerm || statusFilter
                  ? 'Try adjusting your search or status filters.'
                  : 'Get started by creating your first booking case.'}
              </p>
              <Link href="/bookings/new" className="btn-primary">
                <Plus size={16} />
                <span>Create Booking Case</span>
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                id="booking-cases-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Case Number</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Route / Provider</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Applicants</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Preferred Window</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Created</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c: any) => {
                    const statusConfig = getStatusConfig(c.status);
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
                            <span>{c.caseNumber}</span>
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
                            : 'VFS • GRC (Cairo)'}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                          {applicantsCount} {applicantsCount === 1 ? 'applicant' : 'applicants'}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                          {c.preferredDateFrom ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={13} color="#64748b" />
                              {formatDate(c.preferredDateFrom)} → {formatDate(c.preferredDateTo)}
                            </span>
                          ) : (
                            'Any available'
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.8rem' }}>
                          {formatDate(c.createdAt)}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <Link
                            href={`/bookings/${c.id}`}
                            className="btn-secondary"
                            id={`btn-view-case-${c.id}`}
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                          >
                            <span>Details</span>
                            <ChevronRight size={14} />
                          </Link>
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
                Previous
              </button>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-secondary"
                id="btn-next-page"
                style={{ padding: '6px 12px', fontSize: '0.75rem', opacity: page >= totalPages ? 0.4 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

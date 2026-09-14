'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/api-client';
import { AppShell } from '../../components/layout/app-shell';
import { getStatusConfig } from '../../lib/formatters/status';
import { formatAgeSeconds, formatRelativeTime } from '../../lib/formatters/dates';
import {
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';

export default function AttentionQueuePage() {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
                Need Operator Attention
              </h1>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              Priority triage queue for cases blocked waiting for manual verification, payment or intervention
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary"
            id="btn-refresh-attention"
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Attention Table */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
              Loading attention queue...
            </div>
          ) : cases.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle size={40} color="#10b981" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '4px' }}>
                Queue is Clear!
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                No cases currently require human verification or intervention.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                id="attention-cases-table"
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
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Provider / Centre</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Current Status</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Intervention Reason</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500 }}>Waiting Time</th>
                    <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => {
                    const statusConfig = getStatusConfig(c.currentStatus);
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
                            style={{ color: '#60a5fa' }}
                          >
                            {c.caseNumber}
                          </Link>
                        </td>
                        <td style={{ padding: '16px 20px', color: '#cbd5e1' }}>
                          {c.provider} • {c.destination} ({c.centre})
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span className={`badge ${statusConfig.badgeClass}`}>
                            {statusConfig.label}
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
                              Type: {c.humanActionType}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#f59e0b', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={14} />
                            <span>{formatAgeSeconds(c.ageSeconds)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <Link
                            href={`/bookings/${c.caseId}`}
                            className="btn-primary"
                            id={`btn-open-attention-case-${c.caseId}`}
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          >
                            <span>Resolve Now</span>
                            <ArrowUpRight size={14} />
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

'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/api-client';
import { AppShell } from '../../components/layout/app-shell';
import { getStatusConfig } from '../../lib/formatters/status';
import { formatAgeSeconds, formatRelativeTime } from '../../lib/formatters/dates';
import {
  Activity,
  AlertTriangle,
  CalendarCheck2,
  Clock,
  Compass,
  CreditCard,
  Eye,
  Layers,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  Server,
  BarChart2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: summary, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.dashboard.getSummary(),
    refetchInterval: 10000,
  });

  const { data: providerHealthData } = useQuery({
    queryKey: ['providers-health'],
    queryFn: () => api.operations.getProvidersHealth(),
    refetchInterval: 30000,
  });

  const { data: queueHealthData } = useQuery({
    queryKey: ['queue-health'],
    queryFn: () => api.operations.getQueueHealth(),
    refetchInterval: 15000,
  });

  const vfsHealth = providerHealthData?.providers?.[0];
  const queueHealth = queueHealthData?.queues ?? {};

  const counts = summary?.counts ?? {
    total: 0,
    monitoring: 0,
    waitingQueue: 0,
    slotFound: 0,
    paymentRequired: 0,
    confirmed: 0,
    needAttention: 0,
  };

  const kpis = [
    {
      id: 'kpi-total',
      label: 'Total Cases',
      value: counts.total,
      icon: Layers,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
    },
    {
      id: 'kpi-monitoring',
      label: 'In Monitoring',
      value: counts.monitoring,
      icon: Compass,
      color: '#0ea5e9',
      bg: 'rgba(14, 165, 233, 0.12)',
    },
    {
      id: 'kpi-queue',
      label: 'Waiting Queue',
      value: counts.waitingQueue,
      icon: Clock,
      color: '#eab308',
      bg: 'rgba(234, 179, 8, 0.12)',
    },
    {
      id: 'kpi-slot-found',
      label: 'Slot Found',
      value: counts.slotFound,
      icon: Sparkles,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
    },
    {
      id: 'kpi-payment',
      label: 'Payment Required',
      value: counts.paymentRequired,
      icon: CreditCard,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
    },
    {
      id: 'kpi-confirmed',
      label: 'Confirmed',
      value: counts.confirmed,
      icon: CalendarCheck2,
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.12)',
    },
    {
      id: 'kpi-attention',
      label: 'Need Attention',
      value: counts.needAttention,
      icon: AlertTriangle,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      highlight: true,
    },
  ];

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
              Operations Dashboard
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              Live real-time monitoring and high-urgency operations console
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary"
            id="btn-refresh-dashboard"
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            <Activity size={14} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Provider Health & Queue Metrics */}
        <div
          id="dashboard-infra-health"
          style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}
        >
          {/* VFS Provider Health Pill */}
          <div
            className="glass-card"
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: '1 1 260px',
            }}
          >
            <Server size={16} color="#94a3b8" />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>VFS Provider</span>
            {vfsHealth ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color:
                    vfsHealth.status === 'HEALTHY'
                      ? '#10b981'
                      : vfsHealth.status === 'DEGRADED'
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              >
                {vfsHealth.status === 'HEALTHY' ? (
                  <CheckCircle2 size={14} />
                ) : vfsHealth.status === 'DEGRADED' ? (
                  <AlertCircle size={14} />
                ) : (
                  <XCircle size={14} />
                )}
                {vfsHealth.status}
                {vfsHealth.activeSessions > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                    ({vfsHealth.activeSessions} active)
                  </span>
                )}
              </span>
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>—</span>
            )}
          </div>

          {/* Queue Health Pill */}
          <div
            className="glass-card"
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: '1 1 500px',
              flexWrap: 'wrap',
            }}
          >
            <BarChart2 size={16} color="#94a3b8" />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>Queue Depth</span>
            {Object.entries(queueHealth).map(([name, info]: [string, any]) => (
              <span
                key={name}
                id={`queue-depth-${name}`}
                style={{
                  fontSize: '0.78rem',
                  color: info.failed > 10 ? '#ef4444' : '#64748b',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#94a3b8' }}>{name.replace(/-/g, ' ')}:</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {info.waiting}W / {info.active}A
                </span>
                {info.failed > 0 && (
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>
                    {info.failed}F
                  </span>
                )}
              </span>
            ))}
            {Object.keys(queueHealth).length === 0 && (
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>—</span>
            )}
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div
          id="dashboard-kpis-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '16px',
          }}
        >
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.id}
                id={kpi.id}
                className="glass-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: kpi.highlight && kpi.value > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
                  boxShadow:
                    kpi.highlight && kpi.value > 0 ? '0 4px 20px rgba(239, 68, 68, 0.2)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
                    {kpi.label}
                  </span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: kpi.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: kpi.color,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: kpi.color, lineHeight: 1 }}>
                  {isLoading ? '...' : kpi.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Attention Items Section */}
        <div
          id="dashboard-attention-section"
          className="glass-card"
          style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <ShieldAlert size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                  Need Operator Attention
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Cases blocked waiting for manual verification, payment or intervention
                </span>
              </div>
            </div>
            <Link
              href="/attention"
              id="link-view-all-attention"
              style={{
                fontSize: '0.8rem',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
              }}
            >
              <span>View Attention Queue</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Attention Table */}
          {summary?.attentionItems && summary.attentionItems.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Case</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Provider / Route</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Reason</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500 }}>Waiting Time</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.attentionItems.map((item) => {
                    const statusConfig = getStatusConfig(item.currentStatus);
                    return (
                      <tr
                        key={item.caseId}
                        id={`attention-row-${item.caseId}`}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px 12px', fontWeight: 600, color: '#f8fafc' }}>
                          <Link
                            href={`/bookings/${item.caseId}`}
                            style={{ color: '#60a5fa', textDecoration: 'underline' }}
                          >
                            {item.caseNumber}
                          </Link>
                        </td>
                        <td style={{ padding: '14px 12px', color: '#cbd5e1' }}>
                          {item.provider} • {item.destination} ({item.centre})
                        </td>
                        <td style={{ padding: '14px 12px' }}>
                          <span className={`badge ${statusConfig.badgeClass}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td style={{ padding: '14px 12px', color: '#e2e8f0', maxWidth: '300px' }}>
                          {item.reason}
                        </td>
                        <td style={{ padding: '14px 12px', color: '#f59e0b', fontWeight: 600 }}>
                          {formatAgeSeconds(item.ageSeconds)}
                        </td>
                        <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                          <Link
                            href={`/bookings/${item.caseId}`}
                            className="btn-primary"
                            id={`btn-resolve-attention-${item.caseId}`}
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                          >
                            <span>Resolve Now</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: '36px',
                textAlign: 'center',
                color: '#64748b',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
              }}
            >
              <CalendarCheck2 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                All clear! No cases currently require human intervention.
              </p>
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div
          id="dashboard-activity-section"
          className="glass-card"
          style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <Activity size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                Recent Operational Activity
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Live audit trail of automation steps and state transitions
              </span>
            </div>
          </div>

          {summary?.recentActivity && summary.recentActivity.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {summary.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  id={`activity-item-${activity.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activity.caseNumber && (
                        <Link
                          href={`/bookings/${activity.caseId}`}
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#60a5fa',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {activity.caseNumber}
                        </Link>
                      )}
                      <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>
                        {activity.message}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Event: {activity.eventType}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              No recent activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

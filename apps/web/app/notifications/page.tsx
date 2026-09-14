'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/api-client';
import { AppShell } from '../../components/layout/app-shell';
import { formatRelativeTime, formatDateTime } from '../../lib/formatters/dates';
import {
  Bell,
  CheckCheck,
  Calendar,
  AlertTriangle,
  Info,
  CheckCircle2,
  Filter,
} from 'lucide-react';

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { unreadOnly }],
    queryFn: () => api.notifications.list({ unreadOnly, limit: 50 }),
    refetchInterval: 10000,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.notifications.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.notifications.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.items ?? [];

  return (
    <AppShell>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                <Bell size={18} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
                Notifications Center
              </h1>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              Real-time operational alerts, system notifications, and challenge prompts
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              id="btn-toggle-unread"
              onClick={() => setUnreadOnly((prev) => !prev)}
              className="btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '6px 14px',
                borderColor: unreadOnly ? '#3b82f6' : undefined,
                color: unreadOnly ? '#60a5fa' : undefined,
              }}
            >
              <Filter size={14} />
              <span>{unreadOnly ? 'Showing Unread' : 'Filter Unread'}</span>
            </button>

            <button
              id="btn-mark-all-read"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending || notifications.length === 0}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              <CheckCheck size={14} />
              <span>Mark all as read</span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <Bell size={36} color="#475569" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '4px' }}>
                No notifications to display
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                {unreadOnly
                  ? 'You have caught up with all notifications.'
                  : 'System activity and alerts will appear here.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notifications.map((notif) => {
                const isUnread = !notif.readAt;
                return (
                  <div
                    key={notif.id}
                    id={`notification-row-${notif.id}`}
                    style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      backgroundColor: isUnread ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '16px',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isUnread ? '#3b82f6' : 'transparent',
                          marginTop: '8px',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: isUnread ? 700 : 500,
                              color: '#f8fafc',
                            }}
                          >
                            {notif.title}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#94a3b8',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {notif.type}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '4px' }}>
                          {notif.message}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: '#64748b' }}>
                          <span>{formatRelativeTime(notif.createdAt)}</span>
                          {notif.bookingCaseId && (
                            <>
                              <span>•</span>
                              <Link
                                href={`/bookings/${notif.bookingCaseId}`}
                                style={{ color: '#60a5fa', textDecoration: 'underline' }}
                              >
                                View Related Case
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isUnread && (
                      <button
                        onClick={() => markReadMutation.mutate(notif.id)}
                        className="btn-secondary"
                        id={`btn-mark-read-${notif.id}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

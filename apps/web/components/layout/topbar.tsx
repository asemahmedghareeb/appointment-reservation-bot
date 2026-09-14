'use client';

import React from 'react';
import Link from 'next/link';
import { useOperationsEvents } from '../../lib/realtime/use-sse';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/api-client';
import { Bell, Radio, Plus } from 'lucide-react';

export function Topbar() {
  const { isConnected } = useOperationsEvents();

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', { unreadOnly: true }],
    queryFn: () => api.notifications.list({ unreadOnly: true, limit: 10 }),
    refetchInterval: 15000,
  });

  const unreadCount = notificationsData?.total ?? 0;

  return (
    <header
      id="visaflow-topbar"
      style={{
        height: '64px',
        backgroundColor: 'rgba(13, 19, 34, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Operations Console</span>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>Real-Time Control</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* SSE Live Connection Pill */}
        <div
          id="realtime-status-indicator"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: isConnected ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: isConnected ? '#34d399' : '#fbbf24',
          }}
        >
          <span
            className={isConnected ? 'pulse-dot' : ''}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#10b981' : '#f59e0b',
              display: 'inline-block',
            }}
          />
          <Radio size={12} />
          <span>{isConnected ? 'LIVE (SSE Connected)' : 'Connecting stream...'}</span>
        </div>

        {/* Notifications Icon Button */}
        <Link
          href="/notifications"
          id="btn-topbar-notifications"
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              id="notifications-badge-count"
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* New Case Button */}
        <Link
          href="/bookings/new"
          id="btn-topbar-new-case"
          className="btn-primary"
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <Plus size={15} />
          <span>New Case</span>
        </Link>
      </div>
    </header>
  );
}

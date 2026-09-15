'use client';

import React from 'react';
import { Link } from '../../i18n/navigation';
import { useTranslations } from 'next-intl';
import { useOperationsEvents } from '../../lib/realtime/use-sse';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/api-client';
import { Bell, Radio, Plus } from 'lucide-react';
import { LanguageSwitcher } from '../locale/language-switcher';

export function Topbar() {
  const { isConnected } = useOperationsEvents();
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');

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
        <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
          {tCommon('operationsConsole')}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
          {tCommon('realTimeControl')}
        </span>
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
          <Radio size={12} className={isConnected ? 'animate-pulse' : ''} />
          <span>{isConnected ? tCommon('liveConnected') : tCommon('disconnected')}</span>
        </div>

        {/* Notifications Icon Button */}
        <Link
          href="/notifications"
          id="btn-topbar-notifications"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#94a3b8',
            transition: 'all 0.15s ease',
          }}
          aria-label={tNav('notifications')}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              id="topbar-unread-badge"
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.6875rem',
                fontWeight: 700,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-app)',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Quick New Booking Button */}
        <Link
          href="/bookings/new"
          id="btn-topbar-new-booking"
          className="btn-primary"
          style={{ height: '36px', padding: '0 14px', fontSize: '0.8125rem' }}
        >
          <Plus size={15} />
          <span>{tNav('newBooking')}</span>
        </Link>
      </div>
    </header>
  );
}

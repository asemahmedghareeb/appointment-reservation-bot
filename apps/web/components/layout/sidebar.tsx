'use client';

import React from 'react';
import { Link, usePathname } from '../../i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  CalendarDays,
  AlertTriangle,
  Bell,
  Layers,
  PlusCircle,
  FileCheck2,
  Users,
  UserCheck,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const navItems = [
    { href: '/dashboard', label: tNav('dashboard'), icon: LayoutDashboard },
    { href: '/bookings', label: tNav('bookings'), icon: CalendarDays },
    { href: '/clients', label: tNav('clients'), icon: Users },
    { href: '/applicants', label: tNav('applicants'), icon: UserCheck },
    { href: '/attention', label: tNav('attention'), icon: AlertTriangle, highlight: true },
    { href: '/notifications', label: tNav('notifications'), icon: Bell },
  ];

  return (
    <aside
      id="visaflow-sidebar"
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        borderInlineEnd: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        userSelect: 'none',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '24px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
          }}
        >
          <Layers size={20} />
        </div>
        <div>
          <h1
            style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#f8fafc',
            }}
          >
            VisaFlow
          </h1>
          <span
            style={{
              fontSize: '0.7rem',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            {tCommon('operationsConsole')}
          </span>
        </div>
      </div>

      {/* Quick Action Button */}
      <div style={{ padding: '16px 16px 8px 16px' }}>
        <Link
          href="/bookings/new"
          prefetch={true}
          id="btn-sidebar-new-booking"
          className="btn-primary"
          style={{ width: '100%', boxSizing: 'border-box' }}
        >
          <PlusCircle size={16} />
          <span>{tNav('newBooking')}</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard' || pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              id={`nav-link-${item.href.replace(/\//g, '')}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#f8fafc' : '#94a3b8',
                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon
                size={18}
                color={isActive ? '#3b82f6' : item.highlight ? '#f59e0b' : '#94a3b8'}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.75rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <FileCheck2 size={16} color="#10b981" />
        <span>VFS Global Active</span>
      </div>
    </aside>
  );
}

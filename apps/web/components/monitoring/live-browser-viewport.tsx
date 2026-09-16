'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Maximize2,
  Minimize2,
  Tv,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

export interface LiveBrowserViewportProps {
  caseId: string;
  providerName?: string;
  botStatus?: string;
}

type VisualStatus = 'CONNECTING' | 'LIVE' | 'STALE' | 'OFFLINE' | 'ERROR';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function LiveBrowserViewport({
  caseId,
  providerName,
  botStatus,
}: LiveBrowserViewportProps) {
  const t = useTranslations('caseDetail');

  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [visualStatus, setVisualStatus] = useState<VisualStatus>('CONNECTING');
  const [lastFrameTime, setLastFrameTime] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [reconnectKey, setReconnectKey] = useState<number>(0);
  const connectTimeRef = useRef<number>(Date.now());

  // Setup SSE connection
  useEffect(() => {
    if (!caseId) return;

    let isSubscribed = true;
    connectTimeRef.current = Date.now();
    setVisualStatus('CONNECTING');

    const streamUrl = `${API_BASE_URL}/operations/cases/${caseId}/live-stream`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('open', () => {
      if (!isSubscribed) return;
      setVisualStatus((prev) => (prev === 'ERROR' ? 'CONNECTING' : prev));
    });

    const handleStatusPayload = (payload: any) => {
      if (payload.status === 'CONNECTING') {
        setVisualStatus((prev) => (prev === 'LIVE' ? prev : 'CONNECTING'));
      } else if (payload.status === 'OFFLINE') {
        setVisualStatus('OFFLINE');
      }
    };

    const handleFramePayload = (payload: any) => {
      if (payload.visualStatus === 'OFFLINE') {
        setVisualStatus('OFFLINE');
        return;
      }

      if (payload.frame) {
        const mime = payload.mimeType || 'image/jpeg';
        setCurrentFrame(`data:${mime};base64,${payload.frame}`);
        setLastFrameTime(Date.now());
        setVisualStatus('LIVE');
      }
    };

    eventSource.addEventListener('status', (event: MessageEvent) => {
      if (!isSubscribed) return;
      try {
        handleStatusPayload(JSON.parse(event.data));
      } catch {
        // Ignore parse error
      }
    });

    eventSource.addEventListener('frame', (event: MessageEvent) => {
      if (!isSubscribed) return;
      try {
        handleFramePayload(JSON.parse(event.data));
      } catch {
        // Ignore frame decoding errors
      }
    });

    // Fallback in case message event is dispatched without specific event name
    eventSource.onmessage = (event: MessageEvent) => {
      if (!isSubscribed) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload.frame || payload.visualStatus) {
          handleFramePayload(payload);
        } else if (payload.status) {
          handleStatusPayload(payload);
        }
      } catch {
        // Ignore parse error
      }
    };

    eventSource.addEventListener('error', () => {
      if (!isSubscribed) return;
      // If we already had frames, mark as STALE; otherwise OFFLINE
      setVisualStatus((prev) => {
        if (prev === 'LIVE') return 'STALE';
        return 'OFFLINE';
      });
    });

    return () => {
      isSubscribed = false;
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [caseId, reconnectKey]);

  // Stale detection timer (runs every second)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastFrameTime) {
        const elapsedSinceConnect = Math.floor((Date.now() - connectTimeRef.current) / 1000);
        if (elapsedSinceConnect > 15) {
          setVisualStatus((prev) => (prev === 'CONNECTING' ? 'OFFLINE' : prev));
        }
        return;
      }

      const elapsed = Math.floor((Date.now() - lastFrameTime) / 1000);
      setSecondsAgo(elapsed);

      // Stale detection thresholds:
      // 0 - 5s: LIVE
      // 5s - 15s: STALE
      // > 15s: OFFLINE
      if (elapsed <= 5) {
        setVisualStatus('LIVE');
      } else if (elapsed > 5 && elapsed <= 15) {
        setVisualStatus('STALE');
      } else {
        setVisualStatus('OFFLINE');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastFrameTime]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleManualReconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setReconnectKey((k) => k + 1);
  }, []);

  // Status badge styling helper
  const getStatusBadge = () => {
    switch (visualStatus) {
      case 'LIVE':
        return {
          label: t('liveMonitorLive'),
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.3)',
          dotPulse: true,
        };
      case 'STALE':
        return {
          label: t('liveMonitorStale'),
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.3)',
          dotPulse: false,
        };
      case 'CONNECTING':
        return {
          label: t('liveMonitorConnecting'),
          color: '#38bdf8',
          bg: 'rgba(56, 189, 248, 0.15)',
          border: 'rgba(56, 189, 248, 0.3)',
          dotPulse: true,
        };
      case 'OFFLINE':
        return {
          label: t('liveMonitorOffline'),
          color: '#94a3b8',
          bg: 'rgba(148, 163, 184, 0.12)',
          border: 'rgba(148, 163, 184, 0.25)',
          dotPulse: false,
        };
      case 'ERROR':
      default:
        return {
          label: t('liveMonitorError'),
          color: '#f87171',
          bg: 'rgba(248, 113, 113, 0.15)',
          border: 'rgba(248, 113, 113, 0.3)',
          dotPulse: false,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      ref={containerRef}
      id="live-browser-monitor-card"
      className="glass-card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        backgroundColor: isFullscreen ? '#070b14' : undefined,
        borderRadius: isFullscreen ? 0 : undefined,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa',
            }}
          >
            <Tv size={18} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  color: '#f8fafc',
                  margin: 0,
                }}
              >
                {t('liveMonitorTitle')}
              </h3>

              {providerName && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#94a3b8',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {providerName}
                </span>
              )}
            </div>

            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {t('liveMonitorProviderBrowser')}
            </span>
          </div>
        </div>

        {/* Right side controls: status badge + UI Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            id="live-monitor-status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: badge.bg,
              border: `1px solid ${badge.border}`,
              color: badge.color,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: badge.color,
                display: 'inline-block',
                boxShadow: badge.dotPulse ? `0 0 8px ${badge.color}` : 'none',
              }}
            />
            <span>{badge.label}</span>
          </div>

          {/* Strictly UI fullscreen toggle */}
          <button
            id="btn-live-monitor-fullscreen"
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? t('liveMonitorExitFullscreen') : t('liveMonitorFullscreen')}
            aria-label={isFullscreen ? t('liveMonitorExitFullscreen') : t('liveMonitorFullscreen')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Main View Area: Fixed 16:10 ratio viewport */}
      <div
        id="live-monitor-screen-container"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          maxHeight: isFullscreen ? 'calc(100vh - 120px)' : '520px',
          backgroundColor: '#050811',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)',
        }}
      >
        {currentFrame ? (
          <>
            {/* Live frame image (STRICTLY READ ONLY, no interaction handlers) */}
            <img
              id="live-monitor-frame-image"
              src={currentFrame}
              alt="Live Playwright Automation Frame"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'none', // Strictly prevent interaction forwarding
              }}
            />

            {/* Subdued warning banner if connection becomes STALE or OFFLINE while preserving last frame */}
            {visualStatus === 'STALE' && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  marginInline: 'auto',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(245, 158, 11, 0.9)',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
              >
                <AlertCircle size={14} />
                <span>{t('liveMonitorStale')}</span>
              </div>
            )}

            {visualStatus === 'OFFLINE' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(5, 8, 17, 0.75)',
                  backdropFilter: 'blur(2px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  color: '#94a3b8',
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                <WifiOff size={28} color="#64748b" />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
                  {t('liveMonitorOffline')}
                </div>
                <div style={{ fontSize: '0.75rem', maxWidth: '380px' }}>
                  {t('liveMonitorNoStreamDesc')}
                </div>
                <button
                  type="button"
                  onClick={handleManualReconnect}
                  style={{
                    marginTop: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={13} />
                  <span>{t('liveMonitorReconnect')}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty / Initial state when no frames have been received yet */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '30px',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            {visualStatus === 'CONNECTING' ? (
              <>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: '3px solid rgba(56, 189, 248, 0.2)',
                    borderTopColor: '#38bdf8',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 500 }}>
                  {t('liveMonitorConnecting')}
                </div>
              </>
            ) : visualStatus === 'OFFLINE' ? (
              <>
                <WifiOff size={32} color="#475569" />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>
                  {t('liveMonitorOffline')}
                </div>
                <div style={{ fontSize: '0.75rem', maxWidth: '340px', color: '#64748b' }}>
                  {t('liveMonitorNoStreamDesc')}
                </div>
                <button
                  type="button"
                  onClick={handleManualReconnect}
                  style={{
                    marginTop: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={13} />
                  <span>{t('liveMonitorReconnect')}</span>
                </button>
              </>
            ) : (
              <>
                <AlertCircle size={32} color="#ef4444" />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f87171' }}>
                  {t('liveMonitorError')}
                </div>
                <button
                  type="button"
                  onClick={handleManualReconnect}
                  style={{
                    marginTop: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={13} />
                  <span>{t('liveMonitorReconnect')}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          paddingInline: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={13} />
          <span>
            {lastFrameTime
              ? secondsAgo === 0
                ? t('liveMonitorLastUpdatedJustNow')
                : t('liveMonitorLastUpdated', { seconds: secondsAgo })
              : t('liveMonitorConnecting')}
          </span>
        </div>

        {/* Independent Status Indicators: Bot Status vs Live Monitor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {botStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{t('liveMonitorBotStatus')}:</span>
              <span
                style={{
                  fontWeight: 600,
                  color: '#e2e8f0',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}
              >
                {botStatus}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{t('liveMonitorVisualStatus')}:</span>
            <span
              style={{
                fontWeight: 600,
                color: badge.color,
              }}
            >
              {visualStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

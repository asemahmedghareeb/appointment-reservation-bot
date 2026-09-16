import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('LiveBrowserViewport Component Verification', () => {
  const componentPath = path.resolve(__dirname, '../components/monitoring/live-browser-viewport.tsx');
  const componentSource = fs.readFileSync(componentPath, 'utf8');

  it('component exists and is strictly read-only', () => {
    expect(componentSource).toBeDefined();

    // Verifies no bot control buttons exist
    expect(componentSource).not.toContain('Pause Bot');
    expect(componentSource).not.toContain('Resume Bot');
    expect(componentSource).not.toContain('Stop Bot');
    expect(componentSource).not.toContain('Manual Control');

    // Verifies no mouse or keyboard event forwarders
    expect(componentSource).not.toContain('onMouseMove');
    expect(componentSource).not.toContain('onMouseDown');
    expect(componentSource).not.toContain('onMouseUp');
    expect(componentSource).not.toContain('onKeyDown');
    expect(componentSource).not.toContain('onKeyUp');
    expect(componentSource).not.toContain('onWheel');
  });

  it('ensures browser frame image has pointer events disabled', () => {
    // pointerEvents: 'none' ensures browser clicks cannot be intercepted/forwarded
    expect(componentSource).toContain("pointerEvents: 'none'");
    expect(componentSource).toContain('draggable={false}');
  });

  it('handles canonical visual states (CONNECTING, LIVE, STALE, OFFLINE, ERROR)', () => {
    expect(componentSource).toContain("'CONNECTING'");
    expect(componentSource).toContain("'LIVE'");
    expect(componentSource).toContain("'STALE'");
    expect(componentSource).toContain("'OFFLINE'");
    expect(componentSource).toContain("'ERROR'");
  });

  it('implements stale detection based on elapsed frame timestamp', () => {
    // 0-5s: LIVE, 5-15s: STALE, >15s: OFFLINE
    expect(componentSource).toContain('elapsed <= 5');
    expect(componentSource).toContain('elapsed > 5 && elapsed <= 15');
  });

  it('provides strictly UI fullscreen toggle without affecting bot execution', () => {
    expect(componentSource).toContain('requestFullscreen');
    expect(componentSource).toContain('exitFullscreen');
    expect(componentSource).toContain('btn-live-monitor-fullscreen');
  });
});

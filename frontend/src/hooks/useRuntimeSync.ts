/**
 * useRuntimeSync — WebSocket hook for cognitive runtime synchronisation.
 *
 * Opens a /ws/session/:sessionId connection, maps incoming events to local
 * state, and auto-reconnects with exponential backoff on disconnect.
 *
 * Enabled only when:
 *  1. `sessionId` is a non-empty string
 *  2. `enabled` prop is true (defaults to true)
 *
 * Usage:
 *   const { runtimeEvents, latestEvent, connectionState } = useRuntimeSync(sessionId);
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

export interface RuntimeSyncEvent {
  type:       string;
  session_id: string;
  timestamp:  string;
  data:       Record<string, unknown>;
  explain:    string;
}

export interface UseRuntimeSyncReturn {
  runtimeEvents:   RuntimeSyncEvent[];
  latestEvent:     RuntimeSyncEvent | null;
  connectionState: ConnectionState;
  clearEvents:     () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_EVENTS       = 50;
const BASE_DELAY_MS    = 1_000;
const MAX_DELAY_MS     = 30_000;
const MAX_RETRIES      = 8;
const DEAD_TIMER_MS    = 45_000; // fire reconnect if no ping received within this window

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRuntimeSync(
  sessionId:   string | null | undefined,
  enabled      = true,
  queryParams?: Record<string, string>,
): UseRuntimeSyncReturn {
  const [runtimeEvents,   setRuntimeEvents]   = useState<RuntimeSyncEvent[]>([]);
  const [latestEvent,     setLatestEvent]     = useState<RuntimeSyncEvent | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('closed');

  const wsRef        = useRef<WebSocket | null>(null);
  const retries      = useRef(0);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const clearDeadTimer = () => {
    if (deadTimerRef.current) { clearTimeout(deadTimerRef.current); deadTimerRef.current = null; }
  };

  const connect = useCallback(() => {
    if (!sessionId || !enabled || !mountedRef.current) return;

    setConnectionState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host     = window.location.host;
    const base     = `${protocol}//${host}/ws/session/${encodeURIComponent(sessionId)}`;
    const qs       = queryParams && Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';
    const url = base + qs;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    /** Reset the 45 s dead-timer. Called on open and on every ping received. */
    const resetDeadTimer = () => {
      clearDeadTimer();
      deadTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        // No ping received within the window — treat as a silent drop
        setConnectionState('error');
        ws.onclose = null; // suppress the normal onclose reconnect path
        ws.close();
        wsRef.current = null;

        if (!enabled || !sessionId || retries.current >= MAX_RETRIES) return;
        const delay = Math.min(BASE_DELAY_MS * 2 ** retries.current, MAX_DELAY_MS);
        retries.current += 1;
        timerRef.current = setTimeout(connect, delay);
      }, DEAD_TIMER_MS);
    };

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      retries.current = 0;
      setConnectionState('open');
      resetDeadTimer(); // start waiting for first ping
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const ev = JSON.parse(evt.data as string) as RuntimeSyncEvent;
        // Respond to server heartbeat pings
        if (ev.type === 'ping') {
          resetDeadTimer();
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: 'pong' })); } catch { /* ignore */ }
          }
          return;
        }
        // Skip internal handshake event from the visible list
        if (ev.type === 'connected') return;
        setLatestEvent(ev);
        setRuntimeEvents(prev => {
          const next = [ev, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      } catch {
        // Malformed JSON — ignore
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setConnectionState('error');
    };

    ws.onclose = () => {
      clearDeadTimer();
      if (!mountedRef.current) return;
      setConnectionState('closed');
      wsRef.current = null;

      if (!enabled || !sessionId) return;
      if (retries.current >= MAX_RETRIES) return;

      const delay = Math.min(BASE_DELAY_MS * 2 ** retries.current, MAX_DELAY_MS);
      retries.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, enabled, JSON.stringify(queryParams)]);

  useEffect(() => {
    mountedRef.current = true;
    clearTimer();
    retries.current = 0;

    if (sessionId && enabled) {
      connect();
    } else {
      setConnectionState('closed');
    }

    return () => {
      mountedRef.current = false;
      clearTimer();
      clearDeadTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent auto-reconnect on intentional unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId, enabled, connect]);

  const clearEvents = useCallback(() => {
    setRuntimeEvents([]);
    setLatestEvent(null);
  }, []);

  return { runtimeEvents, latestEvent, connectionState, clearEvents };
}

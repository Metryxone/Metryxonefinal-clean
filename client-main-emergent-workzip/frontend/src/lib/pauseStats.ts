const STORAGE_KEY = 'mx-pause-events';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 500;

export type PauseEventType = 'start' | 'complete';

export interface PauseEvent {
  type: PauseEventType;
  ts: number;
}

export interface PauseStats {
  totalStarted: number;
  totalCompleted: number;
  completedThisWeek: number;
}

function readEvents(): PauseEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PauseEvent =>
        e && typeof e.ts === 'number' && (e.type === 'start' || e.type === 'complete'),
    );
  } catch {
    return [];
  }
}

function writeEvents(events: PauseEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events;
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* noop */
  }
}

function sendPauseEventToServer(type: PauseEventType, ts: number): void {
  try {
    fetch('/api/pause-analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ts }),
    }).catch(() => {});
  } catch {
    /* noop — never disrupt the user experience */
  }
}

export function recordPauseEvent(type: PauseEventType, now: number = Date.now()): PauseEvent {
  const event: PauseEvent = { type, ts: now };
  const events = readEvents();
  events.push(event);
  writeEvents(events);
  sendPauseEventToServer(type, now);
  return event;
}

export function getPauseStats(now: number = Date.now()): PauseStats {
  const events = readEvents();
  const since = now - WEEK_MS;
  let totalStarted = 0;
  let totalCompleted = 0;
  let completedThisWeek = 0;
  for (const e of events) {
    if (e.type === 'start') {
      totalStarted++;
    } else if (e.type === 'complete') {
      totalCompleted++;
      if (e.ts >= since) completedThisWeek++;
    }
  }
  return { totalStarted, totalCompleted, completedThisWeek };
}

export function ordinal(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function buildPauseEncouragement(stats: PauseStats): string {
  const n = stats.completedThisWeek;
  if (n <= 0) return 'Nicely done — carry that calm with you.';
  if (n === 1) return "That's your first pause this week — well done.";
  return `That's your ${ordinal(n)} pause this week — well done.`;
}

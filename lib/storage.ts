import type { DayState, Task } from './types';
import { DEFAULT_POMODORO_CONFIG } from './types';
import { getTodayString, scheduleFromDayStart } from './scheduler';

export { getTodayString } from './scheduler';

function storageKey(date: string): string {
  return `timebox-${date}`;
}

export function createDefaultDayState(date: string): DayState {
  return {
    date,
    tasks: [],
    overflowTasks: [],
    tomorrowTasks: [],
    dayStart: '09:00',
    dayEnd: '18:00',
    pomodoroConfig: { ...DEFAULT_POMODORO_CONFIG },
  };
}

/** Collect overflow tasks from all previous days, deduped by id. */
function loadPreviousOverflow(): Task[] {
  if (typeof window === 'undefined') return [];
  const seen = new Set<string>();
  const overflow: Task[] = [];

  for (let i = 1; i <= 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const raw = localStorage.getItem(storageKey(`${y}-${m}-${day}`));
    if (!raw) continue;
    try {
      const prev: DayState = JSON.parse(raw);
      for (const t of prev.overflowTasks) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          overflow.push({ ...t, status: 'overflow' });
        }
      }
    } catch { /* corrupt, skip */ }
  }
  return overflow;
}

/** Pull tasks explicitly deferred to "tomorrow" from the most recent previous day. */
function loadDeferredFromYesterday(): Task[] {
  if (typeof window === 'undefined') return [];

  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const raw = localStorage.getItem(storageKey(`${y}-${m}-${day}`));
    if (!raw) continue;
    try {
      const prev: DayState = JSON.parse(raw);
      const deferred = prev.tomorrowTasks ?? [];
      if (deferred.length > 0) return deferred;
    } catch { /* corrupt, skip */ }
    // Only look at most-recent day that has data; stop after first found day
    break;
  }
  return [];
}

export function loadOrCreate(): DayState {
  if (typeof window === 'undefined') {
    return createDefaultDayState(getTodayString());
  }

  const today = getTodayString();
  const key = storageKey(today);
  const raw = localStorage.getItem(key);

  if (raw) {
    try {
      const saved: DayState = JSON.parse(raw);
      if (saved.date === today) {
        // Back-fill missing field for older saved states
        return { ...saved, tomorrowTasks: saved.tomorrowTasks ?? [] };
      }
    } catch { /* corrupt, fall through */ }
  }

  // New day: build fresh state with overflow and deferred tasks
  const prevOverflow = loadPreviousOverflow();
  const deferred = loadDeferredFromYesterday();

  const fresh = createDefaultDayState(today);

  // Deferred tasks go to the TOP of today's agenda (reset to pending, fresh schedule)
  const deferredPending: Task[] = deferred.map(t => ({
    ...t,
    status: 'pending' as const,
    startedAt: undefined,
    isPaused: false,
    pausedAt: undefined,
    scheduledStart: undefined,
    scheduledEnd: undefined,
  }));

  const withAll = {
    ...fresh,
    tasks: deferredPending,
    overflowTasks: prevOverflow,
  };
  return scheduleFromDayStart(withAll);
}

export function saveState(state: DayState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(state.date), JSON.stringify(state));
  } catch { /* storage full or unavailable */ }
}

import type { DayState, Task, BlockedTime } from './types';
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
    blockedTimes: [],
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

/**
 * Collect tasks from the most recent previous day that were still pending or
 * active and were NOT explicitly deferred (i.e. not in tomorrowTasks).
 * These are tasks the user simply didn't get to — carry them forward.
 */
function loadLeftoverFromYesterday(): Task[] {
  if (typeof window === 'undefined') return [];

  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const raw = localStorage.getItem(storageKey(dateStr));
    if (!raw) continue;
    try {
      const prev: DayState = JSON.parse(raw);
      const tomorrowIds = new Set((prev.tomorrowTasks ?? []).map(t => t.id));
      const leftover = prev.tasks
        .filter(t => (t.status === 'pending' || t.status === 'active') && !tomorrowIds.has(t.id))
        .map(t => ({ ...t, deferredFrom: t.deferredFrom ?? dateStr }));
      if (leftover.length > 0) return leftover;
    } catch { /* corrupt, skip */ }
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
        // Back-fill missing fields for older saved states
        return {
          ...saved,
          tomorrowTasks: saved.tomorrowTasks ?? [],
          blockedTimes: (saved as DayState & { blockedTimes?: BlockedTime[] }).blockedTimes ?? [],
        };
      }
    } catch { /* corrupt, fall through */ }
  }

  // New day: build fresh state with overflow, explicitly deferred, and leftover tasks
  const prevOverflow = loadPreviousOverflow();
  const deferred = loadDeferredFromYesterday();
  const leftover = loadLeftoverFromYesterday();

  const fresh = createDefaultDayState(today);

  function resetToPending(t: Task): Task {
    return {
      ...t,
      status: 'pending' as const,
      startedAt: undefined,
      isPaused: false,
      pausedAt: undefined,
      totalPausedMs: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined,
    };
  }

  // Explicit deferrals first, then unfinished leftovers (deduped by id)
  const deferredPending = deferred.map(resetToPending);
  const deferredIds = new Set(deferredPending.map(t => t.id));
  const leftoverPending = leftover
    .filter(t => !deferredIds.has(t.id))
    .map(resetToPending);

  const withAll = {
    ...fresh,
    tasks: [...deferredPending, ...leftoverPending],
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

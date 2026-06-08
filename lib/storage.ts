import type { DayState, Task } from './types';
import { DEFAULT_POMODORO_CONFIG } from './types';
import { getTodayString, scheduleFromDayStart } from './scheduler';

// Re-export for convenience
export { getTodayString } from './scheduler';

function storageKey(date: string): string {
  return `timebox-${date}`;
}

export function createDefaultDayState(date: string): DayState {
  return {
    date,
    tasks: [],
    overflowTasks: [],
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
    const key = storageKey(`${y}-${m}-${day}`);
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const prev: DayState = JSON.parse(raw);
      for (const t of prev.overflowTasks) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          overflow.push({ ...t, status: 'overflow' });
        }
      }
    } catch {
      // corrupt entry, skip
    }
  }
  return overflow;
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
      // Ensure date matches (paranoia check)
      if (saved.date === today) return saved;
    } catch {
      // corrupt, fall through to fresh
    }
  }

  // New day: create fresh state with previous overflow pre-populated
  const prevOverflow = loadPreviousOverflow();
  const fresh = createDefaultDayState(today);
  const withOverflow = { ...fresh, overflowTasks: prevOverflow };
  return scheduleFromDayStart(withOverflow);
}

export function saveState(state: DayState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(state.date), JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}

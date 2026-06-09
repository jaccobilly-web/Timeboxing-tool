import type { DayState, Task, BlockedTime } from './types';

// ── Parsing & Formatting ────────────────────────────────────────────────────

export function parseDayTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatHHMM(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatHHMMSS(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDelta(estimatedMinutes: number, actualMinutes: number): string {
  const delta = Math.abs(actualMinutes - estimatedMinutes);
  if (delta === 0) return 'on time';
  const label = actualMinutes > estimatedMinutes ? 'over' : 'under';
  return `${formatDuration(delta)} ${label}`;
}

// ── Scheduling Engine ───────────────────────────────────────────────────────

interface Interval { start: Date; end: Date }

/**
 * Advance a proposed start time forward until the full [start, start+durationMs]
 * window fits without overlapping any blocked interval.
 * Handles chains: if skipping one meeting lands you inside another, keeps going.
 */
function advancePastBlocked(proposedStart: Date, durationMs: number, meetings: Interval[]): Date {
  const sorted = [...meetings].sort((a, b) => a.start.getTime() - b.start.getTime());
  let start = new Date(proposedStart);
  let changed = true;
  while (changed) {
    changed = false;
    const end = new Date(start.getTime() + durationMs);
    for (const m of sorted) {
      if (start < m.end && end > m.start) {
        start = new Date(m.end);
        changed = true;
        break;
      }
    }
  }
  return start;
}

function toIntervals(blockedTimes: BlockedTime[], date: string): Interval[] {
  return blockedTimes
    .map(bt => ({ start: parseDayTime(date, bt.start), end: parseDayTime(date, bt.end) }))
    .filter(m => m.end > m.start);
}

/**
 * Recalculate scheduledStart/scheduledEnd for all pending tasks.
 * Only pending tasks are rescheduled; active/complete are untouched.
 * Tasks are placed around any blocked-time windows (meetings).
 * Tasks that push past dayEnd are moved to overflowTasks.
 *
 * @param state     Current DayState
 * @param fromTime  Wall-clock time to begin scheduling pending tasks from.
 */
export function recalculateSchedule(state: DayState, fromTime: Date): DayState {
  const dayEndTime = parseDayTime(state.date, state.dayEnd);
  const meetings = toIntervals(state.blockedTimes ?? [], state.date);

  let cursor = new Date(fromTime);

  const newTasks: Task[] = [];
  const addedToOverflow = new Set<string>(state.overflowTasks.map(t => t.id));
  const newOverflow: Task[] = [...state.overflowTasks];
  let overflowing = false;

  for (const task of state.tasks) {
    if (task.status === 'complete' || task.status === 'active') {
      newTasks.push(task);
      continue;
    }
    if (overflowing) {
      if (!addedToOverflow.has(task.id)) {
        addedToOverflow.add(task.id);
        newOverflow.push({ ...task, status: 'overflow', scheduledStart: undefined, scheduledEnd: undefined });
      }
      continue;
    }

    const durationMs = task.estimatedMinutes * 60_000;
    // manualStart acts as a floor; still nudge past any meeting that blocks it
    const proposed = task.manualStart ? parseDayTime(state.date, task.manualStart) : new Date(cursor);
    const scheduledStart = advancePastBlocked(proposed, durationMs, meetings);
    const scheduledEnd   = new Date(scheduledStart.getTime() + durationMs);

    if (scheduledEnd > dayEndTime) {
      overflowing = true;
      if (!addedToOverflow.has(task.id)) {
        addedToOverflow.add(task.id);
        newOverflow.push({ ...task, status: 'overflow', scheduledStart: undefined, scheduledEnd: undefined });
      }
    } else {
      newTasks.push({
        ...task,
        status: 'pending',
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd:   scheduledEnd.toISOString(),
      });
      cursor = scheduledEnd;
    }
  }

  return { ...state, tasks: newTasks, overflowTasks: newOverflow };
}

/**
 * Determine the wall-clock time from which pending tasks should be scheduled.
 * - If there is an active task: use its expected end (startedAt + estimate),
 *   or `now` if the task is already over its estimate.
 * - Otherwise: max(dayStart, now)
 */
export function getPendingFromTime(state: DayState, now: Date): Date {
  const dayStartTime = parseDayTime(state.date, state.dayStart);
  const activeTask = state.tasks.find(t => t.status === 'active');

  if (activeTask?.startedAt) {
    const expectedEnd = new Date(
      new Date(activeTask.startedAt).getTime() + activeTask.estimatedMinutes * 60_000
    );
    // If running over, pending tasks pile up from "now"
    return expectedEnd > now ? expectedEnd : now;
  }

  return now > dayStartTime ? now : dayStartTime;
}

/**
 * Initial schedule on day load with no active task.
 */
export function scheduleFromDayStart(state: DayState): DayState {
  const dayStartTime = parseDayTime(state.date, state.dayStart);
  return recalculateSchedule(state, dayStartTime);
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

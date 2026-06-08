import type { DayState } from './types';
import { formatDuration } from './scheduler';

export interface TaskRecord {
  date: string;
  title: string;
  estimatedMinutes: number;
  actualMinutes: number;
  ratio: number;
}

export interface DayRecord {
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  overflowCount: number;
  estimatedMinutes: number;
  actualMinutes: number;
  completionRate: number;
}

export interface HistoricalStats {
  dayRecords: DayRecord[];       // newest first
  taskRecords: TaskRecord[];
  totalDays: number;
  totalTasksCompleted: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  overallRatio: number;          // actual / estimated; >1 means overrunning
  tasksUnder: number;            // actual < estimate * 0.9
  tasksOver: number;             // actual > estimate * 1.1
  tasksOnTime: number;           // within 10%
  medianRatio: number;
}

function emptyStats(): HistoricalStats {
  return {
    dayRecords: [], taskRecords: [],
    totalDays: 0, totalTasksCompleted: 0,
    totalEstimatedMinutes: 0, totalActualMinutes: 0,
    overallRatio: 1, tasksUnder: 0, tasksOver: 0, tasksOnTime: 0,
    medianRatio: 1,
  };
}

export function loadHistoricalStats(lookbackDays = 90): HistoricalStats {
  if (typeof window === 'undefined') return emptyStats();

  const dayRecords: DayRecord[] = [];
  const taskRecords: TaskRecord[] = [];

  for (let i = 0; i <= lookbackDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const raw = localStorage.getItem(`timebox-${dateStr}`);
    if (!raw) continue;

    let state: DayState;
    try { state = JSON.parse(raw); } catch { continue; }

    const completed = state.tasks.filter(
      t => t.status === 'complete' && t.actualMinutes !== undefined
    );
    const planned = state.tasks.filter(t => t.status !== 'overflow').length;
    if (planned === 0 && completed.length === 0) continue;

    const estimatedMinutes = completed.reduce((s, t) => s + t.estimatedMinutes, 0);
    const actualMinutes = completed.reduce((s, t) => s + (t.actualMinutes ?? 0), 0);

    dayRecords.push({
      date: dateStr,
      tasksPlanned: planned,
      tasksCompleted: completed.length,
      overflowCount: state.overflowTasks.length,
      estimatedMinutes,
      actualMinutes,
      completionRate: planned > 0 ? completed.length / planned : 0,
    });

    for (const task of completed) {
      if (task.actualMinutes === undefined || task.estimatedMinutes === 0) continue;
      taskRecords.push({
        date: dateStr,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.actualMinutes,
        ratio: task.actualMinutes / task.estimatedMinutes,
      });
    }
  }

  if (taskRecords.length === 0) return emptyStats();

  const totalEstimatedMinutes = taskRecords.reduce((s, t) => s + t.estimatedMinutes, 0);
  const totalActualMinutes = taskRecords.reduce((s, t) => s + t.actualMinutes, 0);
  const overallRatio = totalEstimatedMinutes > 0 ? totalActualMinutes / totalEstimatedMinutes : 1;

  const sorted = [...taskRecords].sort((a, b) => a.ratio - b.ratio);
  const mid = Math.floor(sorted.length / 2);
  const medianRatio =
    sorted.length % 2 === 0
      ? (sorted[mid - 1].ratio + sorted[mid].ratio) / 2
      : sorted[mid].ratio;

  const tasksOnTime = taskRecords.filter(t => Math.abs(t.ratio - 1) <= 0.1).length;
  const tasksUnder = taskRecords.filter(t => t.ratio < 0.9).length;
  const tasksOver = taskRecords.filter(t => t.ratio > 1.1).length;

  return {
    dayRecords: dayRecords.sort((a, b) => b.date.localeCompare(a.date)),
    taskRecords,
    totalDays: dayRecords.length,
    totalTasksCompleted: taskRecords.length,
    totalEstimatedMinutes,
    totalActualMinutes,
    overallRatio,
    tasksUnder,
    tasksOver,
    tasksOnTime,
    medianRatio,
  };
}

export { formatDuration };

'use client';

import type { DayState } from '@/lib/types';
import { formatDuration } from '@/lib/scheduler';

interface SessionSummaryProps {
  state: DayState;
  now: Date;
}

export default function SessionSummary({ state, now }: SessionSummaryProps) {
  const { tasks } = state;

  const allTasks = [...tasks, ...state.overflowTasks];
  const completedTasks = tasks.filter(t => t.status === 'complete');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const activeTask = tasks.find(t => t.status === 'active');
  const agendaCount = tasks.filter(t => t.status !== 'overflow').length;

  const totalPlannedMinutes = tasks
    .filter(t => t.status !== 'overflow')
    .reduce((s, t) => s + t.estimatedMinutes, 0);

  const totalActualMinutes = completedTasks.reduce(
    (s, t) => s + (t.actualMinutes ?? t.estimatedMinutes),
    0
  );

  // Add active task elapsed
  const activeElapsed = activeTask?.startedAt
    ? Math.round((now.getTime() - new Date(activeTask.startedAt).getTime()) / 60_000)
    : 0;

  const completionRate =
    agendaCount > 0 ? Math.round((completedTasks.length / agendaCount) * 100) : 0;

  const rows = [
    { label: 'planned', value: `${agendaCount} tasks` },
    { label: 'complete', value: `${completedTasks.length} tasks` },
    { label: 'remaining', value: `${pendingTasks.length + (activeTask ? 1 : 0)} tasks` },
    { label: 'overflow', value: `${state.overflowTasks.length} tasks` },
    { label: 'est. time', value: formatDuration(totalPlannedMinutes) },
    {
      label: 'actual time',
      value: formatDuration(totalActualMinutes + activeElapsed),
    },
    { label: 'completion', value: `${completionRate}%` },
  ];

  return (
    <div className="border border-border bg-surface">
      <div className="px-3 py-2 border-b border-border">
        <span className="font-mono text-xs text-muted tracking-widest">SESSION</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-3 py-1.5">
            <span className="font-mono text-xs text-muted">{label}</span>
            <span className="font-mono text-xs text-tx">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

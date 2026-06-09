'use client';

import type { Task } from '@/lib/types';
import { formatHHMMSS } from '@/lib/scheduler';
import QuickAdd from './QuickAdd';
import TimelineView from './TimelineView';

interface AgendaPanelProps {
  tasks: Task[];
  now: Date;
  date: string;
  dayStart: string;
  dayEnd: string;
  onAddTask: (title: string, minutes: number) => void;
  onStartTask: (id: string) => void;
  onStartNow: (id: string) => void;
  onCompleteTask: (id: string) => void;
  onPauseTask: (id: string) => void;
  onResumeTask: (id: string) => void;
  onReschedule: () => void;
  onRemoveTask: (id: string) => void;
  onMoveToOverflow: (id: string) => void;
  onSetTaskStartTime: (id: string, time: string | undefined) => void;
  onSetElapsed: (id: string, minutes: number) => void;
  onDeferToTomorrow: (id: string) => void;
  onOpenStats: () => void;
}

export default function AgendaPanel({
  tasks,
  now,
  date,
  dayStart,
  dayEnd,
  onAddTask,
  onStartTask,
  onStartNow,
  onCompleteTask,
  onPauseTask,
  onResumeTask,
  onReschedule,
  onRemoveTask,
  onMoveToOverflow,
  onSetTaskStartTime,
  onSetElapsed,
  onDeferToTomorrow,
  onOpenStats,
}: AgendaPanelProps) {
  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Clock */}
      <div className="px-4 py-3 border-b border-border flex items-start justify-between">
        <div>
          <div className="font-mono text-4xl font-bold text-tx tracking-tight">
            {formatHHMMSS(now)}
          </div>
          <div className="font-mono text-xs text-muted mt-0.5">
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <button
          onClick={onOpenStats}
          className="font-mono text-xs text-muted hover:text-tx border border-border px-2 py-1 mt-1 transition-colors tracking-widest"
        >
          STATS
        </button>
      </div>

      {/* Quick add */}
      <div className="px-4 py-2 border-b border-border">
        <QuickAdd onAdd={onAddTask} />
      </div>

      {/* Timeline */}
      <TimelineView
        tasks={tasks}
        now={now}
        date={date}
        dayStart={dayStart}
        dayEnd={dayEnd}
        onStart={onStartTask}
        onStartNow={onStartNow}
        onComplete={onCompleteTask}
        onPause={onPauseTask}
        onResume={onResumeTask}
        onReschedule={onReschedule}
        onSetElapsed={onSetElapsed}
        onRemove={onRemoveTask}
        onMoveToOverflow={onMoveToOverflow}
        onDeferToTomorrow={onDeferToTomorrow}
        onSetStartTime={onSetTaskStartTime}
      />
    </div>
  );
}

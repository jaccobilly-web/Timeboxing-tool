'use client';

import { useState, useRef } from 'react';
import type { Task, BlockedTime } from '@/lib/types';
import { formatHHMMSS } from '@/lib/scheduler';
import QuickAdd from './QuickAdd';
import TimelineView from './TimelineView';

interface AgendaPanelProps {
  tasks: Task[];
  blockedTimes: BlockedTime[];
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
  onAddBlockedTime: (title: string, start: string, end: string) => void;
  onRemoveBlockedTime: (id: string) => void;
}

function BlockTimeForm({ onAdd }: { onAdd: (title: string, start: string, end: string) => void }) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd]     = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!start || !end || end <= start) return;
    onAdd(title.trim() || 'Meeting', start, end);
    setTitle('');
    setStart('');
    setEnd('');
    titleRef.current?.focus();
  }

  const isValid = !!start && !!end && end > start;

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5 items-center flex-wrap">
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder="Meeting"
        className="flex-1 min-w-0 bg-s2 border border-border px-2 py-1 font-mono text-xs text-tx placeholder-dim focus:outline-none focus:border-violet-500/50"
        maxLength={80}
        autoComplete="off"
      />
      <input
        type="time"
        value={start}
        onChange={e => setStart(e.target.value)}
        className="w-[5.5rem] bg-s2 border border-border px-2 py-1 font-mono text-xs text-tx focus:outline-none focus:border-violet-500/50"
      />
      <span className="font-mono text-xs text-dim">–</span>
      <input
        type="time"
        value={end}
        onChange={e => setEnd(e.target.value)}
        className="w-[5.5rem] bg-s2 border border-border px-2 py-1 font-mono text-xs text-tx focus:outline-none focus:border-violet-500/50"
      />
      <button
        type="submit"
        disabled={!isValid}
        className="font-mono text-xs border px-2 py-1 transition-colors disabled:text-dim disabled:border-dim text-violet-400 border-violet-500/40 hover:bg-violet-950/40"
      >
        + block
      </button>
    </form>
  );
}

export default function AgendaPanel({
  tasks,
  blockedTimes,
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
  onAddBlockedTime,
  onRemoveBlockedTime,
}: AgendaPanelProps) {
  const [mode, setMode] = useState<'task' | 'block'>('task');

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

      {/* Quick add / Block time — tabbed */}
      <div className="px-4 pt-2 pb-2 border-b border-border space-y-2">
        {/* Mode toggle */}
        <div className="flex gap-0">
          <button
            onClick={() => setMode('task')}
            className={`font-mono text-xs px-2 py-0.5 border transition-colors ${
              mode === 'task'
                ? 'text-accent border-accent-mid/50 bg-accent-dim/20'
                : 'text-dim border-border hover:text-muted'
            }`}
          >
            task
          </button>
          <button
            onClick={() => setMode('block')}
            className={`font-mono text-xs px-2 py-0.5 border-t border-b border-r transition-colors ${
              mode === 'block'
                ? 'text-violet-400 border-violet-500/40 bg-violet-950/30'
                : 'text-dim border-border hover:text-muted'
            }`}
          >
            meeting
          </button>
        </div>

        {mode === 'task'  && <QuickAdd onAdd={onAddTask} />}
        {mode === 'block' && <BlockTimeForm onAdd={onAddBlockedTime} />}
      </div>

      {/* Timeline */}
      <TimelineView
        tasks={tasks}
        blockedTimes={blockedTimes}
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
        onRemoveBlockedTime={onRemoveBlockedTime}
      />
    </div>
  );
}

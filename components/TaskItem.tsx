'use client';

import { useState } from 'react';
import type { Task } from '@/lib/types';
import { formatHHMM, formatDuration, formatElapsed, formatDelta } from '@/lib/scheduler';

interface TaskItemProps {
  task: Task;
  now: Date;
  onStart?: () => void;
  onComplete?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onReschedule?: () => void;
  onRemove?: () => void;
  onMoveToOverflow?: () => void;
  onSetStartTime?: (time: string | undefined) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}

export default function TaskItem({
  task,
  now,
  onStart,
  onComplete,
  onPause,
  onResume,
  onReschedule,
  onRemove,
  onMoveToOverflow,
  onSetStartTime,
  dragHandleProps,
  isDragging,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [timeInput, setTimeInput] = useState('');

  const scheduledStart = task.scheduledStart ? new Date(task.scheduledStart) : null;
  const scheduledEnd = task.scheduledEnd ? new Date(task.scheduledEnd) : null;
  const startedAt = task.startedAt ? new Date(task.startedAt) : null;

  // Effective elapsed excludes all paused periods
  const totalPausedMs = task.totalPausedMs ?? 0;
  const currentPauseMs =
    task.isPaused && task.pausedAt
      ? now.getTime() - new Date(task.pausedAt).getTime()
      : 0;
  const effectiveElapsedMs =
    task.status === 'active' && startedAt
      ? Math.max(0, now.getTime() - startedAt.getTime() - totalPausedMs - currentPauseMs)
      : 0;
  const elapsedSeconds = Math.floor(effectiveElapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  const isRunningOver = task.status === 'active' && !task.isPaused && elapsedMinutes >= task.estimatedMinutes;
  const overByMinutes = isRunningOver ? elapsedMinutes - task.estimatedMinutes : 0;

  const timeSlot =
    scheduledStart && scheduledEnd
      ? `${formatHHMM(scheduledStart)} – ${formatHHMM(scheduledEnd)}`
      : null;

  const isPinned = !!task.manualStart;

  // ── Border/background by state ────────────────────────────────────────────
  let containerClass = 'border-l-2 ';
  if (task.status === 'active') {
    containerClass += isRunningOver
      ? 'border-danger bg-danger-dim/20'
      : task.isPaused
      ? 'border-muted bg-s2'
      : 'border-accent bg-accent-dim/20';
  } else if (task.status === 'complete') {
    containerClass += 'border-success/30 opacity-55';
  } else {
    containerClass += 'border-border hover:border-border-strong';
  }

  // ── Time-slot editing ─────────────────────────────────────────────────────
  function openTimeEdit() {
    setTimeInput(
      task.manualStart ??
        (scheduledStart ? formatHHMM(scheduledStart) : '')
    );
    setEditingTime(true);
  }

  function confirmTimeEdit() {
    if (timeInput && onSetStartTime) onSetStartTime(timeInput);
    setEditingTime(false);
  }

  function clearManualTime() {
    if (onSetStartTime) onSetStartTime(undefined);
    setEditingTime(false);
  }

  function handleTimeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); confirmTimeEdit(); }
    if (e.key === 'Escape') setEditingTime(false);
  }

  return (
    <div
      className={`relative px-3 py-2 bg-surface ${containerClass} transition-colors select-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle — pending only */}
        {task.status === 'pending' && (
          <button
            {...dragHandleProps}
            className="mt-0.5 text-dim hover:text-muted cursor-grab active:cursor-grabbing touch-none font-mono text-xs leading-none pt-px flex-shrink-0"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
        )}

        {/* Status indicator */}
        <span className="mt-1.5 flex-shrink-0">
          {task.status === 'complete' && (
            <span className="text-success font-mono text-xs">✓</span>
          )}
          {task.status === 'active' && (
            <span
              className={`block w-2 h-2 rounded-full ${
                task.isPaused
                  ? 'bg-muted'
                  : isRunningOver
                  ? 'bg-danger animate-pulse'
                  : 'bg-accent animate-pulse'
              }`}
            />
          )}
          {task.status === 'pending' && (
            <span className="block w-2 h-2 rounded-full bg-dim" />
          )}
          {task.status === 'overflow' && (
            <span className="block w-2 h-2 rounded-full bg-muted" />
          )}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`font-sans text-sm font-medium truncate ${
                task.status === 'complete' ? 'line-through text-muted' : 'text-tx'
              }`}
            >
              {task.title}
            </span>
            <span className="font-mono text-xs text-muted flex-shrink-0">
              {formatDuration(task.estimatedMinutes)}
            </span>
          </div>

          {/* Time slot row */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {/* Editable time slot for pending tasks */}
            {task.status === 'pending' && onSetStartTime && (
              editingTime ? (
                <span className="flex items-center gap-1">
                  <input
                    type="time"
                    value={timeInput}
                    onChange={e => setTimeInput(e.target.value)}
                    onKeyDown={handleTimeKeyDown}
                    autoFocus
                    className="font-mono text-xs bg-s2 border border-accent-mid/60 px-1 py-0 text-tx focus:outline-none w-[5.5rem]"
                  />
                  <button
                    onClick={confirmTimeEdit}
                    className="font-mono text-xs text-accent border border-accent-mid/50 px-1.5 py-0 hover:bg-accent-dim transition-colors"
                  >
                    set
                  </button>
                  {isPinned && (
                    <button
                      onClick={clearManualTime}
                      className="font-mono text-xs text-muted hover:text-tx transition-colors px-1"
                      title="Clear manual time"
                    >
                      auto
                    </button>
                  )}
                  <button
                    onClick={() => setEditingTime(false)}
                    className="font-mono text-xs text-dim hover:text-muted px-1"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <button
                  onClick={openTimeEdit}
                  className={`font-mono text-xs hover:text-tx transition-colors ${
                    isPinned ? 'text-tx' : 'text-muted'
                  }`}
                  title={isPinned ? 'Click to edit pinned start time' : 'Click to pin start time'}
                >
                  {timeSlot ?? 'pin time'}
                  {isPinned && (
                    <span className="ml-1 text-accent">⊕</span>
                  )}
                </button>
              )
            )}

            {/* Read-only time for active/complete */}
            {task.status !== 'pending' && timeSlot && (
              <span className="font-mono text-xs text-muted">{timeSlot}</span>
            )}

            {/* Active elapsed / paused state */}
            {task.status === 'active' && (
              task.isPaused ? (
                <span className="font-mono text-xs text-muted tracking-wider">PAUSED · {formatElapsed(elapsedSeconds)}</span>
              ) : (
                <span className={`font-mono text-xs font-bold ${isRunningOver ? 'text-danger' : 'text-accent'}`}>
                  {formatElapsed(elapsedSeconds)}
                </span>
              )
            )}

            {/* Complete delta */}
            {task.status === 'complete' && task.actualMinutes !== undefined && (
              <span
                className={`font-mono text-xs ${
                  task.actualMinutes > task.estimatedMinutes ? 'text-danger' : 'text-success'
                }`}
              >
                {formatDelta(task.estimatedMinutes, task.actualMinutes)}
              </span>
            )}

            {/* Late-start warning */}
            {task.status === 'pending' && scheduledStart && scheduledStart < now && (
              <span className="font-mono text-xs text-danger">
                {formatDuration(Math.round((now.getTime() - scheduledStart.getTime()) / 60_000))} late
              </span>
            )}
          </div>

          {/* Overrun warning */}
          {isRunningOver && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-mono text-xs text-danger font-bold">
                ⚠ {formatDuration(overByMinutes)} over estimate
              </span>
              {onReschedule && (
                <button
                  onClick={onReschedule}
                  className="font-mono text-xs text-danger border border-danger-dim px-1.5 py-0.5 hover:bg-danger-dim transition-colors"
                >
                  reschedule now
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.status === 'active' && (
            <>
              {task.isPaused ? (
                <button
                  onClick={onResume}
                  className="font-mono text-xs text-accent border border-accent-mid/40 px-2 py-0.5 hover:bg-accent-dim transition-colors"
                  title="Resume task"
                >
                  ▶
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="font-mono text-xs text-muted border border-border px-2 py-0.5 hover:text-tx hover:border-border-strong transition-colors"
                  title="Pause task"
                >
                  ⏸
                </button>
              )}
              <button
                onClick={onComplete}
                className="font-mono text-xs text-success border border-success/30 px-2 py-0.5 hover:bg-success-dim transition-colors"
              >
                done
              </button>
            </>
          )}
          {task.status === 'pending' && onStart && (
            <button
              onClick={onStart}
              className="font-mono text-xs text-accent border border-accent-mid/40 px-2 py-0.5 hover:bg-accent-dim transition-colors"
            >
              ▶
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="font-mono text-xs text-dim hover:text-muted px-1 py-0.5"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded options */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border flex gap-2 flex-wrap items-center">
          {task.status === 'pending' && onMoveToOverflow && (
            <button
              onClick={() => { onMoveToOverflow(); setExpanded(false); }}
              className="font-mono text-xs text-muted border border-border px-2 py-0.5 hover:text-tx hover:border-border-strong transition-colors"
            >
              → not today
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => { onRemove(); setExpanded(false); }}
              className="font-mono text-xs text-danger/70 border border-danger-dim/50 px-2 py-0.5 hover:text-danger hover:border-danger-dim transition-colors"
            >
              delete
            </button>
          )}
          <span className="font-mono text-xs text-dim ml-auto">
            added {new Date(task.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}

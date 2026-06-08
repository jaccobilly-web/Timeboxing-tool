'use client';

import { useState, useEffect } from 'react';
import type { Task } from '@/lib/types';
import { formatHHMM, formatDuration, formatElapsed, formatDelta } from '@/lib/scheduler';

interface TaskItemProps {
  task: Task;
  now: Date;
  onStart?: () => void;
  onComplete?: () => void;
  onReschedule?: () => void;
  onRemove?: () => void;
  onMoveToOverflow?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}

export default function TaskItem({
  task,
  now,
  onStart,
  onComplete,
  onReschedule,
  onRemove,
  onMoveToOverflow,
  dragHandleProps,
  isDragging,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);

  const scheduledStart = task.scheduledStart ? new Date(task.scheduledStart) : null;
  const scheduledEnd = task.scheduledEnd ? new Date(task.scheduledEnd) : null;
  const startedAt = task.startedAt ? new Date(task.startedAt) : null;

  const elapsedSeconds = task.status === 'active' && startedAt
    ? Math.floor((now.getTime() - startedAt.getTime()) / 1000)
    : 0;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const isRunningOver = task.status === 'active' && elapsedMinutes >= task.estimatedMinutes;
  const overByMinutes = isRunningOver ? elapsedMinutes - task.estimatedMinutes : 0;

  // Beep once when task first goes over (track via ref pattern with state)
  const [warnedOver, setWarnedOver] = useState(false);
  useEffect(() => {
    if (isRunningOver && !warnedOver) {
      setWarnedOver(true);
    }
  }, [isRunningOver, warnedOver]);

  const timeSlot =
    scheduledStart && scheduledEnd
      ? `${formatHHMM(scheduledStart)} – ${formatHHMM(scheduledEnd)}`
      : null;

  const statusClass =
    task.status === 'active'
      ? isRunningOver
        ? 'border-l-2 border-danger bg-danger-dim/30'
        : 'border-l-2 border-accent bg-accent-dim/30'
      : task.status === 'complete'
      ? 'border-l-2 border-success/40 opacity-60'
      : 'border-l-2 border-border hover:border-border-strong';

  return (
    <div
      className={`relative px-3 py-2 bg-surface ${statusClass} transition-colors select-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle — only for pending */}
        {task.status === 'pending' && (
          <button
            {...dragHandleProps}
            className="mt-0.5 text-dim hover:text-muted cursor-grab active:cursor-grabbing touch-none flex-shrink-0 font-mono text-xs leading-none pt-px"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
        )}

        {/* Status dot */}
        <span className="mt-1.5 flex-shrink-0">
          {task.status === 'complete' && <span className="text-success font-mono text-xs">✓</span>}
          {task.status === 'active' && (
            <span className={`block w-2 h-2 rounded-full ${isRunningOver ? 'bg-danger animate-pulse' : 'bg-accent animate-pulse'}`} />
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
          <div className="flex items-center gap-3 mt-0.5">
            {timeSlot && (
              <span className="font-mono text-xs text-muted">{timeSlot}</span>
            )}
            {task.status === 'active' && (
              <span className={`font-mono text-xs font-bold ${isRunningOver ? 'text-danger' : 'text-accent'}`}>
                {formatElapsed(elapsedSeconds)}
              </span>
            )}
            {task.status === 'complete' && task.actualMinutes !== undefined && (
              <span className={`font-mono text-xs ${
                task.actualMinutes > task.estimatedMinutes ? 'text-danger' : 'text-success'
              }`}>
                {formatDelta(task.estimatedMinutes, task.actualMinutes)}
              </span>
            )}
          </div>

          {/* Overrun warning */}
          {isRunningOver && (
            <div className="flex items-center gap-2 mt-1">
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

          {/* Late start warning for pending tasks */}
          {task.status === 'pending' && scheduledStart && scheduledStart < now && (
            <span className="font-mono text-xs text-danger">
              {formatDuration(Math.round((now.getTime() - scheduledStart.getTime()) / 60_000))} behind
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.status === 'active' && onComplete && (
            <button
              onClick={onComplete}
              className="font-mono text-xs text-success border border-success/30 px-2 py-0.5 hover:bg-success-dim transition-colors"
            >
              done
            </button>
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
            aria-label="Toggle options"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded options */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border flex gap-2 flex-wrap">
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
              className="font-mono text-xs text-danger/60 border border-danger-dim/40 px-2 py-0.5 hover:text-danger hover:border-danger-dim transition-colors"
            >
              delete
            </button>
          )}
          <span className="font-mono text-xs text-dim ml-auto">
            created {new Date(task.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}

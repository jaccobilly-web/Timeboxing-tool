'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Task, BlockedTime } from '@/lib/types';
import {
  formatHHMM,
  formatDuration,
  formatElapsed,
  formatDelta,
  parseDayTime,
} from '@/lib/scheduler';

// ── Constants ────────────────────────────────────────────────────────────────

const PX_PER_MIN = 1.6;   // vertical pixels per minute of duration
const MIN_BLOCK_H = 30;   // minimum task block height in px
const LABEL_W = 52;       // width of the left time-label column in px

// ── Geometry helpers ─────────────────────────────────────────────────────────

interface BlockGeo {
  task: Task;
  topPx: number;
  heightPx: number;
  startDate: Date;
  endDate: Date;
}

function computeGeo(task: Task, dayStartDate: Date): BlockGeo | null {
  let startDate: Date;
  let endDate: Date;

  if (task.status === 'active' && task.startedAt) {
    startDate = new Date(task.startedAt);
    endDate = new Date(startDate.getTime() + task.estimatedMinutes * 60_000);
  } else if (task.status === 'complete') {
    const s = task.startedAt ?? task.scheduledStart;
    if (!s) return null;
    startDate = new Date(s);
    endDate = task.completedAt
      ? new Date(task.completedAt)
      : new Date(startDate.getTime() + (task.actualMinutes ?? task.estimatedMinutes) * 60_000);
  } else {
    if (!task.scheduledStart || !task.scheduledEnd) return null;
    startDate = new Date(task.scheduledStart);
    endDate = new Date(task.scheduledEnd);
  }

  const topMinutes = (startDate.getTime() - dayStartDate.getTime()) / 60_000;
  const durMinutes = Math.max(1, (endDate.getTime() - startDate.getTime()) / 60_000);

  return {
    task,
    topPx: Math.max(0, topMinutes * PX_PER_MIN),
    heightPx: Math.max(MIN_BLOCK_H, durMinutes * PX_PER_MIN),
    startDate,
    endDate,
  };
}

// ── Task block ───────────────────────────────────────────────────────────────

interface BlockProps {
  geo: BlockGeo;
  now: Date;
  isNextUp: boolean;
  hasActiveTask: boolean;
  onStart: () => void;
  onStartNow: () => void;
  onComplete: () => void;
  onPause: () => void;
  onResume: () => void;
  onReschedule: () => void;
  onSetElapsed: (m: number) => void;
  onRemove: () => void;
  onMoveToOverflow: () => void;
  onDeferToTomorrow: () => void;
  onSetStartTime: (t: string | undefined) => void;
}

function TaskBlock({
  geo, now, isNextUp, hasActiveTask,
  onStart, onStartNow, onComplete, onPause, onResume,
  onReschedule, onSetElapsed, onRemove, onMoveToOverflow,
  onDeferToTomorrow, onSetStartTime,
}: BlockProps) {
  const { task, topPx, heightPx, startDate, endDate } = geo;

  const [menuOpen, setMenuOpen] = useState(false);
  const [editingElapsed, setEditingElapsed] = useState(false);
  const [elapsedInput, setElapsedInput] = useState('');
  const [editingTime, setEditingTime] = useState(false);
  const [timeInput, setTimeInput] = useState('');

  // Close menu on outside click
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Elapsed calculation
  const totalPausedMs = task.totalPausedMs ?? 0;
  const currentPauseMs = task.isPaused && task.pausedAt
    ? now.getTime() - new Date(task.pausedAt).getTime() : 0;
  const elapsedMs = task.status === 'active' && task.startedAt
    ? Math.max(0, now.getTime() - new Date(task.startedAt).getTime() - totalPausedMs - currentPauseMs)
    : 0;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const isOverrun = task.status === 'active' && !task.isPaused && elapsedMin >= task.estimatedMinutes;
  const overByMin = isOverrun ? elapsedMin - task.estimatedMinutes : 0;

  // DnD — drag handle triggers drag; whole block is a drop target
  const {
    setNodeRef: setDragNode,
    attributes: dragAttrs,
    listeners: dragListeners,
    transform,
    isDragging,
  } = useDraggable({ id: task.id, disabled: task.status !== 'pending' });

  const { setNodeRef: setDropNode, isOver: isDropOver } = useDroppable({ id: task.id });

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDragNode(node);
      setDropNode(node);
    },
    [setDragNode, setDropNode]
  );

  // Visual states
  let borderClass: string;
  let bgClass: string;
  let accentColor: string;

  if (task.status === 'active') {
    if (isOverrun)         { borderClass = 'border-danger/60';  bgClass = 'bg-danger-dim/20';  accentColor = '#ef4444'; }
    else if (task.isPaused){ borderClass = 'border-border';     bgClass = 'bg-s2';             accentColor = '#a0a0a0'; }
    else                   { borderClass = 'border-accent/60';  bgClass = 'bg-accent-dim/20';  accentColor = '#f59e0b'; }
  } else if (task.status === 'complete') {
    borderClass = 'border-border'; bgClass = 'bg-surface opacity-50'; accentColor = '#22c55e';
  } else {
    // pending
    borderClass = isDropOver ? 'border-accent/60' : 'border-border hover:border-border-strong';
    bgClass = isDropOver ? 'bg-accent-dim/10' : 'bg-surface';
    accentColor = '#3a3a3a';
  }

  const h = heightPx;
  const isTiny   = h < 38;
  const isSmall  = h >= 38 && h < 58;
  const isMedium = h >= 58 && h < 90;
  const isTall   = h >= 90;

  const timeSlot = `${formatHHMM(startDate)} – ${formatHHMM(endDate)}`;

  return (
    <div
      ref={setRef}
      style={{
        position: 'absolute',
        top: topPx,
        left: 0,
        right: 0,
        height: heightPx,
        transform: CSS.Transform.toString(transform),
        zIndex: isDragging ? 50 : menuOpen ? 20 : 1,
        opacity: isDragging ? 0.35 : 1,
      }}
      className={`border overflow-visible ${borderClass} ${bgClass} transition-colors`}
    >
      {/* Left accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{
          backgroundColor: accentColor,
          opacity: task.status === 'active' ? 1 : 0.6,
        }}
      />

      {/* ── Content ─────────────────────────────────────── */}
      <div className="absolute inset-0 left-1 right-5 px-1.5 py-0.5 flex flex-col gap-0 overflow-hidden">

        {/* Title row */}
        <div className="flex items-start justify-between gap-1 min-h-0">
          <span className={`font-sans text-xs font-medium leading-tight flex-1 min-w-0 ${
            task.status === 'complete' ? 'line-through text-muted' : 'text-tx'
          } ${isTiny ? 'truncate' : ''}`}>
            {task.deferredFrom && <span className="text-info/70 mr-0.5">↩</span>}
            {task.title}
          </span>
          {!isTiny && (
            <span className="font-mono text-xs text-muted flex-shrink-0 leading-tight">
              {formatDuration(task.estimatedMinutes)}
            </span>
          )}
        </div>

        {/* Time slot */}
        {!isTiny && (
          <div className="mt-0.5">
            {task.status === 'pending' && !editingTime && (
              <button
                onClick={() => { setTimeInput(task.manualStart ?? formatHHMM(startDate)); setEditingTime(true); }}
                className={`font-mono text-xs leading-tight hover:text-tx transition-colors ${task.manualStart ? 'text-tx' : 'text-muted'}`}
              >
                {timeSlot}{task.manualStart && <span className="text-accent ml-0.5">⊕</span>}
              </button>
            )}
            {task.status === 'pending' && editingTime && (
              <span className="flex items-center gap-0.5 flex-wrap">
                <input
                  type="time" value={timeInput}
                  onChange={e => setTimeInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onSetStartTime(timeInput || undefined); setEditingTime(false); }
                    if (e.key === 'Escape') setEditingTime(false);
                  }}
                  autoFocus
                  className="font-mono text-xs bg-s2 border border-accent-mid/60 px-1 py-0 text-tx focus:outline-none w-[5rem]"
                />
                <button onClick={() => { onSetStartTime(timeInput || undefined); setEditingTime(false); }} className="font-mono text-xs text-accent">✓</button>
                {task.manualStart && <button onClick={() => { onSetStartTime(undefined); setEditingTime(false); }} className="font-mono text-xs text-muted">auto</button>}
                <button onClick={() => setEditingTime(false)} className="font-mono text-xs text-dim">✕</button>
              </span>
            )}
            {task.status !== 'pending' && (
              <span className="font-mono text-xs text-muted leading-tight">{timeSlot}</span>
            )}
          </div>
        )}

        {/* Active: elapsed timer */}
        {task.status === 'active' && !isTiny && (
          <div className="mt-0.5">
            {task.isPaused ? (
              <span className="font-mono text-xs text-muted tracking-wider">PAUSED · {formatElapsed(elapsedSec)}</span>
            ) : editingElapsed ? (
              <span className="flex items-center gap-0.5">
                <input
                  type="number" value={elapsedInput}
                  onChange={e => setElapsedInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { const m = parseInt(elapsedInput); if (!isNaN(m)) onSetElapsed(m); setEditingElapsed(false); }
                    if (e.key === 'Escape') setEditingElapsed(false);
                  }}
                  autoFocus min="0"
                  className="w-12 font-mono text-xs bg-s2 border border-accent-mid/50 px-1 py-0 text-tx focus:outline-none"
                />
                <span className="font-mono text-xs text-muted">min</span>
                <button onClick={() => { const m = parseInt(elapsedInput); if (!isNaN(m)) onSetElapsed(m); setEditingElapsed(false); }} className="font-mono text-xs text-accent">✓</button>
                <button onClick={() => setEditingElapsed(false)} className="font-mono text-xs text-dim">✕</button>
              </span>
            ) : (
              <button
                onClick={() => { setElapsedInput(String(elapsedMin)); setEditingElapsed(true); }}
                className={`font-mono text-xs font-bold ${isOverrun ? 'text-danger' : 'text-accent'} hover:opacity-70`}
                title="Click to correct elapsed time"
              >
                {formatElapsed(elapsedSec)}
              </button>
            )}
          </div>
        )}

        {/* Complete: delta */}
        {task.status === 'complete' && task.actualMinutes !== undefined && !isTiny && (
          <span className={`font-mono text-xs ${task.actualMinutes > task.estimatedMinutes ? 'text-danger' : 'text-success'}`}>
            {formatDelta(task.estimatedMinutes, task.actualMinutes)}
          </span>
        )}

        {/* Overrun warning (medium/tall) */}
        {isOverrun && (isMedium || isTall) && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="font-mono text-xs text-danger">⚠ {formatDuration(overByMin)} over</span>
            <button onClick={onReschedule} className="font-mono text-xs text-danger border border-danger-dim px-1 hover:bg-danger-dim">reschedule</button>
          </div>
        )}

        {/* Action buttons — tall blocks get full row */}
        {task.status === 'active' && isTall && (
          <div className="flex items-center gap-1 mt-auto pt-0.5 flex-wrap">
            {task.isPaused
              ? <button onClick={onResume} className="font-mono text-xs text-accent border border-accent-mid/40 px-1.5 py-0.5 hover:bg-accent-dim">▶ resume</button>
              : <button onClick={onPause}  className="font-mono text-xs text-muted border border-border px-1.5 py-0.5 hover:text-tx">⏸ pause</button>
            }
            <button onClick={onDeferToTomorrow} className="font-mono text-xs text-info/80 border border-info/20 px-1.5 py-0.5 hover:bg-info-dim">→tmrw</button>
            <button onClick={onComplete} className="font-mono text-xs text-success border border-success/30 px-1.5 py-0.5 hover:bg-success-dim">done</button>
          </div>
        )}

        {/* Medium active: compact actions */}
        {task.status === 'active' && isSmall && (
          <div className="flex items-center gap-1 mt-auto">
            {task.isPaused
              ? <button onClick={onResume} className="font-mono text-xs text-accent border border-accent-mid/40 px-1 hover:bg-accent-dim">▶</button>
              : <button onClick={onPause}  className="font-mono text-xs text-muted border border-border px-1 hover:text-tx">⏸</button>
            }
            <button onClick={onComplete} className="font-mono text-xs text-success border border-success/30 px-1 hover:bg-success-dim">✓</button>
          </div>
        )}

        {/* START NOW banner */}
        {isNextUp && !isTiny && (
          <button
            onClick={onStartNow}
            className="w-full font-mono text-xs font-bold text-bg bg-accent hover:bg-accent/80 py-0.5 text-center mt-auto"
          >
            ▶ START NOW{task.manualStart ? ' (clear pin)' : ''}
          </button>
        )}
      </div>

      {/* ── Right strip: drag handle + menu ──────────────── */}
      <div className="absolute right-0 top-0 bottom-0 w-5 flex flex-col items-center border-l border-border/50">
        {task.status === 'pending' && (
          <button
            ref={node => setDragNode(node as HTMLButtonElement)}
            {...dragAttrs}
            {...dragListeners}
            className="text-dim hover:text-muted cursor-grab active:cursor-grabbing touch-none font-mono text-xs pt-0.5 px-1 flex-shrink-0"
            tabIndex={-1}
          >
            ⠿
          </button>
        )}
        <div ref={menuRef} className="relative mt-auto mb-0.5">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="font-mono text-xs text-dim hover:text-muted px-1"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-full top-0 z-40 bg-surface border border-border shadow-xl min-w-[112px] py-1">
              {task.status === 'active' && (
                <>
                  <button onClick={() => { setMenuOpen(false); task.isPaused ? onResume() : onPause(); }}
                    className="w-full text-left px-3 py-1 font-mono text-xs text-tx hover:bg-s2">
                    {task.isPaused ? '▶ resume' : '⏸ pause'}
                  </button>
                  <button onClick={() => { setMenuOpen(false); onComplete(); }}
                    className="w-full text-left px-3 py-1 font-mono text-xs text-success hover:bg-s2">
                    ✓ done
                  </button>
                </>
              )}
              {task.status === 'pending' && !hasActiveTask && (
                <button onClick={() => { setMenuOpen(false); onStart(); }}
                  className="w-full text-left px-3 py-1 font-mono text-xs text-accent hover:bg-s2">
                  ▶ start
                </button>
              )}
              {task.status === 'pending' && (
                <button onClick={() => { setMenuOpen(false); onMoveToOverflow(); }}
                  className="w-full text-left px-3 py-1 font-mono text-xs text-muted hover:bg-s2">
                  → not today
                </button>
              )}
              {task.status !== 'complete' && (
                <button onClick={() => { setMenuOpen(false); onDeferToTomorrow(); }}
                  className="w-full text-left px-3 py-1 font-mono text-xs text-info/80 hover:bg-s2">
                  → tomorrow
                </button>
              )}
              <div className="my-1 border-t border-border" />
              <button onClick={() => { setMenuOpen(false); onRemove(); }}
                className="w-full text-left px-3 py-1 font-mono text-xs text-danger/70 hover:bg-s2">
                ✕ delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main timeline view ───────────────────────────────────────────────────────

interface Props {
  tasks: Task[];
  blockedTimes: BlockedTime[];
  now: Date;
  date: string;
  dayStart: string;
  dayEnd: string;
  onStart: (id: string) => void;
  onStartNow: (id: string) => void;
  onComplete: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onReschedule: () => void;
  onSetElapsed: (id: string, minutes: number) => void;
  onRemove: (id: string) => void;
  onMoveToOverflow: (id: string) => void;
  onDeferToTomorrow: (id: string) => void;
  onSetStartTime: (id: string, time: string | undefined) => void;
  onRemoveBlockedTime: (id: string) => void;
}

export default function TimelineView({
  tasks, blockedTimes, now, date, dayStart, dayEnd,
  onStart, onStartNow, onComplete, onPause, onResume,
  onReschedule, onSetElapsed, onRemove, onMoveToOverflow,
  onDeferToTomorrow, onSetStartTime, onRemoveBlockedTime,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const dayStartDate = parseDayTime(date, dayStart);
  const dayEndDate   = parseDayTime(date, dayEnd);
  const totalMinutes = (dayEndDate.getTime() - dayStartDate.getTime()) / 60_000;
  const totalHeight  = totalMinutes * PX_PER_MIN;

  // Current time Y
  const nowMinutes = (now.getTime() - dayStartDate.getTime()) / 60_000;
  const nowY = Math.min(totalHeight, Math.max(0, nowMinutes * PX_PER_MIN));
  const nowVisible = nowMinutes >= 0 && nowMinutes <= totalMinutes;

  // Scroll to put current time in view on mount
  useEffect(() => {
    if (containerRef.current && nowVisible) {
      const offset = Math.max(0, nowY - containerRef.current.clientHeight * 0.35);
      containerRef.current.scrollTop = offset;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grid lines every 30 min
  const gridLines: Array<{ relMin: number; absMin: number; isHour: boolean }> = [];
  const startAbsMin = dayStartDate.getHours() * 60 + dayStartDate.getMinutes();
  const endAbsMin   = dayEndDate.getHours()   * 60 + dayEndDate.getMinutes();
  const firstGrid = Math.ceil(startAbsMin / 30) * 30;
  for (let absMin = firstGrid; absMin <= endAbsMin; absMin += 30) {
    const relMin = absMin - startAbsMin;
    if (relMin >= 0 && relMin <= totalMinutes) {
      gridLines.push({ relMin, absMin, isHour: absMin % 60 === 0 });
    }
  }

  const blocks = tasks
    .filter(t => t.status !== 'overflow')
    .map(t => computeGeo(t, dayStartDate))
    .filter((b): b is BlockGeo => b !== null);

  const pendingTasks  = tasks.filter(t => t.status === 'pending');
  const hasActiveTask = tasks.some(t => t.status === 'active');
  const nextUpId      = !hasActiveTask && pendingTasks.length > 0 ? pendingTasks[0].id : null;

  const { setNodeRef: setDropRef } = useDroppable({ id: 'agenda-droppable' });

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setDropRef(node);
  }, [setDropRef]);

  return (
    <div ref={setContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
      <div
        className="relative"
        style={{ height: Math.max(totalHeight, 300), minHeight: '100%' }}
      >
        {/* ── Grid lines ──────────────────────────── */}
        {gridLines.map(({ relMin, absMin, isHour }) => {
          const y = relMin * PX_PER_MIN;
          const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
          const mm = String(absMin % 60).padStart(2, '0');
          return (
            <div
              key={relMin}
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: y }}
            >
              <div
                className="absolute flex items-end justify-end pr-2"
                style={{ width: LABEL_W, top: isHour ? -9 : -7 }}
              >
                <span
                  className={`font-mono leading-none ${
                    isHour
                      ? 'text-xs text-muted'
                      : 'text-muted/50'
                  }`}
                  style={isHour ? undefined : { fontSize: 9 }}
                >
                  {isHour ? `${hh}:00` : `${hh}:30`}
                </span>
              </div>
              <div
                className={`absolute right-0 ${isHour ? 'border-t border-border' : 'border-t border-border/30'}`}
                style={{ left: LABEL_W, borderStyle: isHour ? 'solid' : 'dashed' }}
              />
            </div>
          );
        })}

        {/* ── Current time indicator ────────────── */}
        {nowVisible && (
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: nowY }}
          >
            <div
              className="absolute flex items-end justify-end pr-1.5"
              style={{ width: LABEL_W, top: -9 }}
            >
              <span className="font-mono text-xs text-danger font-bold leading-none">
                {formatHHMM(now)}
              </span>
            </div>
            <div
              className="absolute right-0 border-t-2 border-danger"
              style={{ left: LABEL_W }}
            />
            <div
              className="absolute w-2.5 h-2.5 rounded-full bg-danger border-2 border-bg"
              style={{ left: LABEL_W - 5, top: -5 }}
            />
          </div>
        )}

        {/* ── Blocked-time slabs (behind tasks) ─── */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: LABEL_W + 2, right: 4 }}
        >
          {blockedTimes.map(bt => {
            const btStart = parseDayTime(date, bt.start);
            const btEnd   = parseDayTime(date, bt.end);
            if (btEnd <= btStart) return null;
            const topPx    = Math.max(0, (btStart.getTime() - dayStartDate.getTime()) / 60_000 * PX_PER_MIN);
            const heightPx = Math.max(MIN_BLOCK_H, (btEnd.getTime() - btStart.getTime()) / 60_000 * PX_PER_MIN);
            const h = heightPx;
            return (
              <div
                key={bt.id}
                style={{ position: 'absolute', top: topPx, left: 0, right: 0, height: heightPx, zIndex: 0 }}
                className="border border-violet-500/25 bg-violet-950/40 pointer-events-auto group"
              >
                {/* Left accent stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500/50" />
                {/* Label row */}
                <div className="absolute inset-0 left-1 px-1.5 py-0.5 flex items-start justify-between gap-1 overflow-hidden">
                  <span className={`font-mono text-violet-300/80 truncate leading-tight ${h < 32 ? 'text-[9px]' : 'text-xs'}`}>
                    {bt.title}
                  </span>
                  {h >= 24 && (
                    <span className={`font-mono text-violet-400/60 flex-shrink-0 leading-tight ${h < 32 ? 'text-[9px]' : 'text-xs'}`}>
                      {bt.start}–{bt.end}
                    </span>
                  )}
                </div>
                {/* Remove button (top-right, appears on hover) */}
                <button
                  onClick={() => onRemoveBlockedTime(bt.id)}
                  className="absolute top-0 right-0 font-mono text-[10px] text-violet-400/0 group-hover:text-violet-400/70 hover:!text-violet-200 px-1 py-0 leading-tight transition-colors"
                  title="Remove blocked time"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Task blocks ───────────────────────── */}
        <div
          className="absolute top-0 bottom-0"
          style={{ left: LABEL_W + 2, right: 4 }}
        >
          {blocks.map(geo => (
            <TaskBlock
              key={geo.task.id}
              geo={geo}
              now={now}
              isNextUp={geo.task.id === nextUpId}
              hasActiveTask={hasActiveTask}
              onStart={() => onStart(geo.task.id)}
              onStartNow={() => onStartNow(geo.task.id)}
              onComplete={() => onComplete(geo.task.id)}
              onPause={() => onPause(geo.task.id)}
              onResume={() => onResume(geo.task.id)}
              onReschedule={onReschedule}
              onSetElapsed={m => onSetElapsed(geo.task.id, m)}
              onRemove={() => onRemove(geo.task.id)}
              onMoveToOverflow={() => onMoveToOverflow(geo.task.id)}
              onDeferToTomorrow={() => onDeferToTomorrow(geo.task.id)}
              onSetStartTime={t => onSetStartTime(geo.task.id, t)}
            />
          ))}
        </div>

        {/* Empty state */}
        {tasks.filter(t => t.status !== 'overflow').length === 0 && (
          <div
            className="absolute font-mono text-xs text-dim text-center"
            style={{ left: LABEL_W, right: 0, top: '40%' }}
          >
            no tasks — add one above
          </div>
        )}
      </div>
    </div>
  );
}

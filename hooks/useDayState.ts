'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DayState, Task, BlockedTime } from '@/lib/types';
import {
  recalculateSchedule,
  getPendingFromTime,
  scheduleFromDayStart,
  generateId,
  parseDayTime,
} from '@/lib/scheduler';
import { loadOrCreate, saveState } from '@/lib/storage';
import { arrayMove } from '@dnd-kit/sortable';

export function useDayState(now: Date) {
  const [state, setState] = useState<DayState>(() => loadOrCreate());
  const nowRef = useRef(now);
  nowRef.current = now;

  // Persist on every change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ── Task Actions ──────────────────────────────────────────────────────────

  const addTask = useCallback((title: string, estimatedMinutes: number) => {
    setState(prev => {
      const now = nowRef.current;
      const newTask: Task = {
        id: generateId(),
        title: title.trim(),
        estimatedMinutes,
        status: 'pending',
        createdAt: now.toISOString(),
      };
      const draft = { ...prev, tasks: [...prev.tasks, newTask] };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  const startTask = useCallback((taskId: string) => {
    setState(prev => {
      if (prev.tasks.some(t => t.status === 'active')) return prev;
      const now = nowRef.current;
      const task = prev.tasks.find(t => t.id === taskId);
      if (!task || task.status !== 'pending') return prev;

      const newTasks = prev.tasks.map(t =>
        t.id === taskId
          ? { ...t, status: 'active' as const, startedAt: now.toISOString() }
          : t
      );
      const draft = { ...prev, tasks: newTasks };
      const expectedEnd = new Date(now.getTime() + task.estimatedMinutes * 60_000);
      return recalculateSchedule(draft, expectedEnd);
    });
  }, []);

  /** Like startTask but also clears any manualStart pin, scheduling from now. */
  const startNow = useCallback((taskId: string) => {
    setState(prev => {
      if (prev.tasks.some(t => t.status === 'active')) return prev;
      const now = nowRef.current;
      const task = prev.tasks.find(t => t.id === taskId);
      if (!task || task.status !== 'pending') return prev;

      const newTasks = prev.tasks.map(t =>
        t.id === taskId
          ? { ...t, status: 'active' as const, startedAt: now.toISOString(), manualStart: undefined }
          : t
      );
      const draft = { ...prev, tasks: newTasks };
      const expectedEnd = new Date(now.getTime() + task.estimatedMinutes * 60_000);
      return recalculateSchedule(draft, expectedEnd);
    });
  }, []);

  const completeTask = useCallback((taskId: string) => {
    const completionTime = new Date();
    setState(prev => {
      const task = prev.tasks.find(t => t.id === taskId);
      if (!task || task.status !== 'active') return prev;

      // Subtract all paused time from actual elapsed
      const totalPausedMs = task.totalPausedMs ?? 0;
      const currentPauseMs =
        task.isPaused && task.pausedAt
          ? completionTime.getTime() - new Date(task.pausedAt).getTime()
          : 0;

      const actualMinutes = task.startedAt
        ? Math.max(
            1,
            Math.round(
              (completionTime.getTime() - new Date(task.startedAt).getTime() - totalPausedMs - currentPauseMs) /
                60_000
            )
          )
        : task.estimatedMinutes;

      const newTasks = prev.tasks.map(t =>
        t.id === taskId
          ? {
              ...t,
              status: 'complete' as const,
              actualMinutes,
              completedAt: completionTime.toISOString(),
              isPaused: false,
              pausedAt: undefined,
            }
          : t
      );
      const draft = { ...prev, tasks: newTasks };
      return recalculateSchedule(draft, completionTime);
    });
  }, []);

  const pauseTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === taskId && t.status === 'active' && !t.isPaused
          ? { ...t, isPaused: true, pausedAt: new Date().toISOString() }
          : t
      ),
    }));
  }, []);

  const resumeTask = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id !== taskId || !t.isPaused || !t.pausedAt) return t;
        const pauseDuration = Date.now() - new Date(t.pausedAt).getTime();
        return {
          ...t,
          isPaused: false,
          pausedAt: undefined,
          totalPausedMs: (t.totalPausedMs ?? 0) + pauseDuration,
        };
      }),
    }));
  }, []);

  const updateTaskStart = useCallback((taskId: string, time: string | undefined) => {
    setState(prev => {
      const now = nowRef.current;
      const newTasks = prev.tasks.map(t =>
        t.id === taskId ? { ...t, manualStart: time } : t
      );
      const draft = { ...prev, tasks: newTasks };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  /**
   * Remove a task from today entirely and queue it for tomorrow's agenda.
   * Works on active, pending, and overflow tasks.
   */
  const deferToTomorrow = useCallback((taskId: string) => {
    setState(prev => {
      const now = nowRef.current;
      const task =
        prev.tasks.find(t => t.id === taskId) ??
        prev.overflowTasks.find(t => t.id === taskId);
      if (!task) return prev;

      const deferred: Task = {
        ...task,
        status: 'pending',
        startedAt: undefined,
        isPaused: false,
        pausedAt: undefined,
        totalPausedMs: undefined,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        deferredFrom: prev.date,
      };

      const newTasks = prev.tasks.filter(t => t.id !== taskId);
      const newOverflow = prev.overflowTasks.filter(t => t.id !== taskId);
      // Deduplicate in case it was already queued
      const newTomorrow = [
        ...prev.tomorrowTasks.filter(t => t.id !== taskId),
        deferred,
      ];

      const draft = { ...prev, tasks: newTasks, overflowTasks: newOverflow, tomorrowTasks: newTomorrow };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  /** Correct the elapsed time on an active task (e.g. left running by accident). */
  const setElapsedMinutes = useCallback((taskId: string, minutes: number) => {
    setState(prev => {
      const now = nowRef.current;
      const newStartedAt = new Date(now.getTime() - Math.max(0, minutes) * 60_000);
      return {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === taskId && t.status === 'active'
            ? { ...t, startedAt: newStartedAt.toISOString(), totalPausedMs: 0, isPaused: false, pausedAt: undefined }
            : t
        ),
      };
    });
  }, []);

  const rescheduleNow = useCallback(() => {
    setState(prev => {
      const now = nowRef.current;
      return recalculateSchedule(prev, now);
    });
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setState(prev => {
      const now = nowRef.current;
      const newTasks = prev.tasks.filter(t => t.id !== taskId);
      const newOverflow = prev.overflowTasks.filter(t => t.id !== taskId);
      const draft = { ...prev, tasks: newTasks, overflowTasks: newOverflow };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  /** Reorder two pending tasks by their indices within the pending-only list */
  const reorderAgendaTasks = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const now = nowRef.current;
      const pending = prev.tasks.filter(t => t.status === 'pending');
      const nonPending = prev.tasks.filter(t => t.status !== 'pending');

      const reordered = arrayMove(pending, fromIndex, toIndex);
      const newTasks = [...nonPending, ...reordered];
      const draft = { ...prev, tasks: newTasks };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  /** Move an overflow task into the agenda at a given pending-list index */
  const moveOverflowToAgenda = useCallback((taskId: string, atIndex?: number) => {
    setState(prev => {
      const now = nowRef.current;
      const task = prev.overflowTasks.find(t => t.id === taskId);
      if (!task) return prev;

      const newOverflow = prev.overflowTasks.filter(t => t.id !== taskId);
      const pending = prev.tasks.filter(t => t.status === 'pending');
      const nonPending = prev.tasks.filter(t => t.status !== 'pending');

      const movedTask: Task = { ...task, status: 'pending' };
      const insertAt = atIndex !== undefined && atIndex >= 0 ? atIndex : pending.length;
      const newPending = [
        ...pending.slice(0, insertAt),
        movedTask,
        ...pending.slice(insertAt),
      ];

      const draft = { ...prev, tasks: [...nonPending, ...newPending], overflowTasks: newOverflow };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  /** Move an agenda task to overflow manually */
  const moveToOverflow = useCallback((taskId: string) => {
    setState(prev => {
      const now = nowRef.current;
      const task = prev.tasks.find(t => t.id === taskId);
      if (!task || task.status === 'complete' || task.status === 'active') return prev;

      const overflowTask: Task = { ...task, status: 'overflow', scheduledStart: undefined, scheduledEnd: undefined };
      const newTasks = prev.tasks.filter(t => t.id !== taskId);
      const newOverflow = [...prev.overflowTasks, overflowTask];
      const draft = { ...prev, tasks: newTasks, overflowTasks: newOverflow };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  const updateDaySettings = useCallback((dayStart: string, dayEnd: string) => {
    setState(prev => {
      const draft = { ...prev, dayStart, dayEnd };
      // If there's an active task respect it; otherwise re-schedule from start
      const activeTask = prev.tasks.find(t => t.status === 'active');
      if (activeTask?.startedAt) {
        const now = nowRef.current;
        return recalculateSchedule(draft, now);
      }
      return scheduleFromDayStart(draft);
    });
  }, []);

  const updatePomodoroConfig = useCallback((config: DayState['pomodoroConfig']) => {
    setState(prev => ({ ...prev, pomodoroConfig: config }));
  }, []);

  const updateTaskTitle = useCallback((taskId: string, title: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, title } : t),
    }));
  }, []);

  const addBlockedTime = useCallback((title: string, start: string, end: string) => {
    setState(prev => {
      const now = nowRef.current;
      const draft = {
        ...prev,
        blockedTimes: [
          ...prev.blockedTimes,
          { id: generateId(), title: title.trim() || 'Meeting', start, end } satisfies BlockedTime,
        ],
      };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  const removeBlockedTime = useCallback((id: string) => {
    setState(prev => {
      const now = nowRef.current;
      const draft = { ...prev, blockedTimes: prev.blockedTimes.filter(b => b.id !== id) };
      const fromTime = getPendingFromTime(draft, now);
      return recalculateSchedule(draft, fromTime);
    });
  }, []);

  return {
    state,
    addTask,
    startTask,
    startNow,
    completeTask,
    pauseTask,
    resumeTask,
    rescheduleNow,
    removeTask,
    reorderAgendaTasks,
    moveOverflowToAgenda,
    moveToOverflow,
    updateDaySettings,
    updatePomodoroConfig,
    updateTaskTitle,
    updateTaskStart,
    setElapsedMinutes,
    deferToTomorrow,
    addBlockedTime,
    removeBlockedTime,
  };
}

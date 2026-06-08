'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DayState, Task } from '@/lib/types';
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
      // Only one active task allowed
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
      // Pending tasks start after this task's expected end
      const expectedEnd = new Date(now.getTime() + task.estimatedMinutes * 60_000);
      return recalculateSchedule(draft, expectedEnd);
    });
  }, []);

  const completeTask = useCallback((taskId: string) => {
    const completionTime = new Date();
    setState(prev => {
      const task = prev.tasks.find(t => t.id === taskId);
      if (!task || task.status !== 'active') return prev;

      const actualMinutes = task.startedAt
        ? Math.max(1, Math.round((completionTime.getTime() - new Date(task.startedAt).getTime()) / 60_000))
        : task.estimatedMinutes;

      const newTasks = prev.tasks.map(t =>
        t.id === taskId
          ? {
              ...t,
              status: 'complete' as const,
              actualMinutes,
              completedAt: completionTime.toISOString(),
            }
          : t
      );
      const draft = { ...prev, tasks: newTasks };
      return recalculateSchedule(draft, completionTime);
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

  return {
    state,
    addTask,
    startTask,
    completeTask,
    rescheduleNow,
    removeTask,
    reorderAgendaTasks,
    moveOverflowToAgenda,
    moveToOverflow,
    updateDaySettings,
    updatePomodoroConfig,
    updateTaskTitle,
  };
}

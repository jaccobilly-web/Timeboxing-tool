'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

import { useClock } from '@/hooks/useClock';
import { useDayState } from '@/hooks/useDayState';
import { usePomodoro } from '@/hooks/usePomodoro';

import AgendaPanel from '@/components/AgendaPanel';
import ControlsPanel from '@/components/ControlsPanel';
import StatsModal from '@/components/StatsModal';
import type { Task } from '@/lib/types';
import { formatDuration } from '@/lib/scheduler';

function DragCard({ task }: { task: Task }) {
  return (
    <div className="px-3 py-2 bg-s2 border border-border-strong shadow-xl font-sans text-sm text-tx flex items-center gap-2 max-w-xs">
      <span className="font-mono text-xs text-muted">⠿</span>
      <span className="truncate">{task.title}</span>
      <span className="font-mono text-xs text-dim ml-auto">{formatDuration(task.estimatedMinutes)}</span>
    </div>
  );
}

export default function HomePage() {
  const now = useClock();
  const dayState = useDayState(now);
  const { state } = dayState;

  const pom = usePomodoro(state.pomodoroConfig);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeDragTask =
    activeDragId != null
      ? (state.tasks.find(t => t.id === activeDragId) ??
         state.overflowTasks.find(t => t.id === activeDragId) ??
         null)
      : null;

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveDragId(active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveDragId(null);
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const isFromAgenda = state.tasks.some(t => t.id === activeId && t.status === 'pending');
      const isFromOverflow = state.overflowTasks.some(t => t.id === activeId);

      if (isFromAgenda) {
        const pendingTasks = state.tasks.filter(t => t.status === 'pending');
        const oldIndex = pendingTasks.findIndex(t => t.id === activeId);
        const newIndex = pendingTasks.findIndex(t => t.id === overId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          dayState.reorderAgendaTasks(oldIndex, newIndex);
        }
      } else if (isFromOverflow) {
        const pendingTasks = state.tasks.filter(t => t.status === 'pending');
        const insertIndex = pendingTasks.findIndex(t => t.id === overId);
        if (overId === 'agenda-droppable' || overId === 'overflow-droppable') {
          dayState.moveOverflowToAgenda(activeId);
        } else if (insertIndex !== -1) {
          dayState.moveOverflowToAgenda(activeId, insertIndex);
        } else {
          dayState.moveOverflowToAgenda(activeId);
        }
      }
    },
    [state.tasks, state.overflowTasks, dayState]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-bg overflow-hidden">
        {/* Left panel — Today's Agenda */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <AgendaPanel
            tasks={state.tasks}
            blockedTimes={state.blockedTimes}
            now={now}
            date={state.date}
            dayStart={state.dayStart}
            dayEnd={state.dayEnd}
            onAddTask={dayState.addTask}
            onStartTask={dayState.startTask}
            onStartNow={dayState.startNow}
            onCompleteTask={dayState.completeTask}
            onPauseTask={dayState.pauseTask}
            onResumeTask={dayState.resumeTask}
            onReschedule={dayState.rescheduleNow}
            onRemoveTask={dayState.removeTask}
            onMoveToOverflow={dayState.moveToOverflow}
            onSetTaskStartTime={dayState.updateTaskStart}
            onSetElapsed={dayState.setElapsedMinutes}
            onDeferToTomorrow={dayState.deferToTomorrow}
            onOpenStats={() => setShowStats(true)}
            onAddBlockedTime={dayState.addBlockedTime}
            onRemoveBlockedTime={dayState.removeBlockedTime}
          />
        </div>

        {/* Right panel — Controls */}
        <div className="w-72 flex-shrink-0 border-l border-border overflow-hidden">
          <ControlsPanel
            state={state}
            now={now}
            pomState={pom.pomState}
            onPomodoroToggle={pom.toggle}
            onPomodoroReset={pom.reset}
            onPomodoroSkip={pom.skip}
            onPomodoroResetAll={pom.resetAll}
            onPomodoroConfigChange={dayState.updatePomodoroConfig}
            onMoveToAgenda={dayState.moveOverflowToAgenda}
            onRemoveOverflow={dayState.removeTask}
            onUpdateDaySettings={dayState.updateDaySettings}
          />
        </div>
      </div>

      <DragOverlay>
        {activeDragTask ? <DragCard task={activeDragTask} /> : null}
      </DragOverlay>

      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
    </DndContext>
  );
}

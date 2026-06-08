'use client';

import { useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import type { Task } from '@/lib/types';
import { formatHHMMSS } from '@/lib/scheduler';
import TaskItem from './TaskItem';
import QuickAdd from './QuickAdd';

interface AgendaPanelProps {
  tasks: Task[];
  now: Date;
  onAddTask: (title: string, minutes: number) => void;
  onStartTask: (id: string) => void;
  onCompleteTask: (id: string) => void;
  onReschedule: () => void;
  onRemoveTask: (id: string) => void;
  onMoveToOverflow: (id: string) => void;
}

function SortableTaskRow({
  task,
  now,
  onStart,
  onComplete,
  onReschedule,
  onRemove,
  onMoveToOverflow,
}: {
  task: Task;
  now: Date;
  onStart?: () => void;
  onComplete?: () => void;
  onReschedule?: () => void;
  onRemove?: () => void;
  onMoveToOverflow?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: task.status !== 'pending' });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        now={now}
        onStart={onStart}
        onComplete={onComplete}
        onReschedule={onReschedule}
        onRemove={onRemove}
        onMoveToOverflow={onMoveToOverflow}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
        isDragging={isDragging}
      />
    </div>
  );
}

export default function AgendaPanel({
  tasks,
  now,
  onAddTask,
  onStartTask,
  onCompleteTask,
  onReschedule,
  onRemoveTask,
  onMoveToOverflow,
}: AgendaPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const { setNodeRef: setDropRef } = useDroppable({ id: 'agenda-droppable' });

  const completedTasks = tasks.filter(t => t.status === 'complete');
  const activeTask = tasks.find(t => t.status === 'active');
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const sortableIds = pendingTasks.map(t => t.id);

  const hasActiveTask = !!activeTask;

  const visibleCompleted = showAll ? completedTasks : completedTasks.slice(-3);

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Clock */}
      <div className="px-4 py-3 border-b border-border">
        <div className="font-mono text-4xl font-bold text-tx tracking-tight">
          {formatHHMMSS(now)}
        </div>
        <div className="font-mono text-xs text-muted mt-0.5">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Quick add */}
      <div className="px-4 py-2 border-b border-border">
        <QuickAdd onAdd={onAddTask} />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto" ref={setDropRef}>
        {/* Completed (collapsed, last 3) */}
        {completedTasks.length > 0 && (
          <div className="border-b border-border">
            {completedTasks.length > 3 && (
              <button
                onClick={() => setShowAll(s => !s)}
                className="w-full px-3 py-1 text-left font-mono text-xs text-dim hover:text-muted transition-colors"
              >
                {showAll ? '▲ hide older' : `▼ +${completedTasks.length - 3} completed`}
              </button>
            )}
            <div className="divide-y divide-border">
              {visibleCompleted.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  now={now}
                  onRemove={() => onRemoveTask(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Active task */}
        {activeTask && (
          <div className="border-b border-border">
            <TaskItem
              task={activeTask}
              now={now}
              onComplete={() => onCompleteTask(activeTask.id)}
              onReschedule={onReschedule}
              onRemove={() => onRemoveTask(activeTask.id)}
            />
          </div>
        )}

        {/* Pending tasks (sortable) */}
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-border">
            {pendingTasks.map(task => (
              <SortableTaskRow
                key={task.id}
                task={task}
                now={now}
                onStart={!hasActiveTask ? () => onStartTask(task.id) : undefined}
                onReschedule={onReschedule}
                onRemove={() => onRemoveTask(task.id)}
                onMoveToOverflow={() => onMoveToOverflow(task.id)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="px-4 py-8 text-center font-mono text-xs text-dim">
            no tasks scheduled<br />add one above
          </div>
        )}
        {tasks.length > 0 && pendingTasks.length === 0 && !activeTask && (
          <div className="px-4 py-4 text-center font-mono text-xs text-muted">
            all tasks complete
          </div>
        )}
      </div>
    </div>
  );
}

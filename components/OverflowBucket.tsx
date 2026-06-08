'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/lib/types';
import { formatDuration } from '@/lib/scheduler';

function DraggableOverflowTask({
  task,
  onMoveToAgenda,
  onRemove,
}: {
  task: Task;
  onMoveToAgenda: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { source: 'overflow' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0 bg-surface hover:bg-s2 transition-colors"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-dim hover:text-muted cursor-grab active:cursor-grabbing touch-none font-mono text-xs"
        tabIndex={-1}
      >
        ⠿
      </button>
      <span className="block w-2 h-2 rounded-full bg-muted flex-shrink-0" />
      <span className="flex-1 min-w-0 font-sans text-sm text-muted truncate">{task.title}</span>
      <span className="font-mono text-xs text-dim flex-shrink-0">{formatDuration(task.estimatedMinutes)}</span>
      <button
        onClick={onMoveToAgenda}
        className="font-mono text-xs text-accent border border-accent-mid/40 px-1.5 py-0.5 hover:bg-accent-dim transition-colors flex-shrink-0"
        title="Move back to today"
      >
        ← today
      </button>
      <button
        onClick={onRemove}
        className="font-mono text-xs text-dim hover:text-danger transition-colors"
        title="Delete task"
      >
        ✕
      </button>
    </div>
  );
}

interface OverflowBucketProps {
  tasks: Task[];
  onMoveToAgenda: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function OverflowBucket({ tasks, onMoveToAgenda, onRemove }: OverflowBucketProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'overflow-droppable' });

  return (
    <div
      ref={setNodeRef}
      className={`border border-border bg-surface transition-colors ${isOver ? 'border-muted' : ''}`}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs text-muted tracking-widest">NOT TODAY</span>
        <span className="font-mono text-xs text-dim">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className="px-3 py-4 text-center font-mono text-xs text-dim">empty</div>
      ) : (
        <div>
          {tasks.map(task => (
            <DraggableOverflowTask
              key={task.id}
              task={task}
              onMoveToAgenda={() => onMoveToAgenda(task.id)}
              onRemove={() => onRemove(task.id)}
            />
          ))}
        </div>
      )}
      {tasks.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border">
          <span className="font-mono text-xs text-dim">
            {formatDuration(tasks.reduce((s, t) => s + t.estimatedMinutes, 0))} deferred
          </span>
        </div>
      )}
    </div>
  );
}

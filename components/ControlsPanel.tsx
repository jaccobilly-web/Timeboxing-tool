'use client';

import type { DayState } from '@/lib/types';
import type { PomodoroState } from '@/hooks/usePomodoro';
import PomodoroTimer from './PomodoroTimer';
import OverflowBucket from './OverflowBucket';
import DaySettings from './DaySettings';
import SessionSummary from './SessionSummary';

interface ControlsPanelProps {
  state: DayState;
  now: Date;
  pomState: PomodoroState;
  onPomodoroToggle: () => void;
  onPomodoroReset: () => void;
  onPomodoroSkip: () => void;
  onPomodoroResetAll: () => void;
  onPomodoroConfigChange: (c: DayState['pomodoroConfig']) => void;
  onMoveToAgenda: (id: string) => void;
  onRemoveOverflow: (id: string) => void;
  onUpdateDaySettings: (start: string, end: string) => void;
}

export default function ControlsPanel({
  state,
  now,
  pomState,
  onPomodoroToggle,
  onPomodoroReset,
  onPomodoroSkip,
  onPomodoroResetAll,
  onPomodoroConfigChange,
  onMoveToAgenda,
  onRemoveOverflow,
  onUpdateDaySettings,
}: ControlsPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto gap-3 p-3">
      <PomodoroTimer
        pomState={pomState}
        config={state.pomodoroConfig}
        onToggle={onPomodoroToggle}
        onReset={onPomodoroReset}
        onSkip={onPomodoroSkip}
        onResetAll={onPomodoroResetAll}
        onConfigChange={onPomodoroConfigChange}
      />
      <OverflowBucket
        tasks={state.overflowTasks}
        onMoveToAgenda={onMoveToAgenda}
        onRemove={onRemoveOverflow}
      />
      <DaySettings
        date={state.date}
        dayStart={state.dayStart}
        dayEnd={state.dayEnd}
        onUpdate={onUpdateDaySettings}
      />
      <SessionSummary state={state} now={now} />
    </div>
  );
}

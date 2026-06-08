'use client';

import { useState } from 'react';
import type { PomodoroConfig } from '@/lib/types';
import type { PomodoroState, PomodoroPhase } from '@/hooks/usePomodoro';
import { formatElapsed } from '@/lib/scheduler';

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function phaseLabel(phase: PomodoroPhase): string {
  if (phase === 'work') return 'WORK';
  if (phase === 'break') return 'BREAK';
  return 'LONG BREAK';
}

function phaseColor(phase: PomodoroPhase): string {
  if (phase === 'work') return '#f59e0b';
  if (phase === 'break') return '#3b82f6';
  return '#8b5cf6';
}

interface PomodoroTimerProps {
  pomState: PomodoroState;
  config: PomodoroConfig;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
  onResetAll: () => void;
  onConfigChange: (c: PomodoroConfig) => void;
}

export default function PomodoroTimer({
  pomState,
  config,
  onToggle,
  onReset,
  onSkip,
  onResetAll,
  onConfigChange,
}: PomodoroTimerProps) {
  const { phase, secondsLeft, totalSeconds, isRunning, cycleCount } = pomState;
  const [editing, setEditing] = useState(false);
  const [cfg, setCfg] = useState(config);

  const progress = secondsLeft / totalSeconds;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const color = phaseColor(phase);
  const dotCount = config.cyclesBeforeLongBreak;
  const workDone = cycleCount;

  function saveConfig() {
    onConfigChange(cfg);
    setEditing(false);
  }

  return (
    <div className="p-3 border border-border bg-surface">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-muted tracking-widest">POMODORO</span>
        <button
          onClick={() => { setCfg(config); setEditing(e => !e); }}
          className="font-mono text-xs text-dim hover:text-muted"
        >
          {editing ? 'cancel' : 'config'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-2">
          {(
            [
              { label: 'work min', key: 'workMinutes', min: 1, max: 120 },
              { label: 'break min', key: 'breakMinutes', min: 1, max: 60 },
              { label: 'long break', key: 'longBreakMinutes', min: 1, max: 120 },
              { label: 'cycles → long', key: 'cyclesBeforeLongBreak', min: 1, max: 10 },
            ] as { label: string; key: keyof PomodoroConfig; min: number; max: number }[]
          ).map(({ label, key, min, max }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">{label}</span>
              <input
                type="number"
                value={cfg[key]}
                onChange={e =>
                  setCfg(prev => ({
                    ...prev,
                    [key]: Math.max(min, Math.min(max, parseInt(e.target.value) || prev[key])),
                  }))
                }
                min={min}
                max={max}
                className="w-16 bg-s2 border border-border px-2 py-0.5 font-mono text-xs text-tx focus:outline-none focus:border-border-strong text-right"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveConfig}
              className="flex-1 font-mono text-xs border border-accent-mid/50 text-accent hover:bg-accent-dim py-1 transition-colors"
            >
              apply
            </button>
            <button
              onClick={() => { onResetAll(); setEditing(false); }}
              className="font-mono text-xs border border-border text-muted hover:text-tx px-3 py-1 transition-colors"
            >
              reset
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-center mb-1">
            <span className="font-mono text-xs tracking-widest" style={{ color }}>
              {phaseLabel(phase)}
            </span>
          </div>

          {/* Ring countdown */}
          <div className="flex justify-center mb-2">
            <svg width="110" height="110" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#1e1e1e" strokeWidth="5" />
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="5"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                transform="rotate(-90 50 50)"
                style={{ transition: isRunning ? 'stroke-dashoffset 1s linear' : undefined }}
              />
              <text
                x="50" y="46"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#d4d4d4"
                fontSize="16"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {formatElapsed(secondsLeft)}
              </text>
              <text
                x="50" y="62"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#6b6b6b"
                fontSize="8"
                fontFamily="monospace"
                letterSpacing="2"
              >
                {Array.from({ length: dotCount }, (_, i) => (workDone % dotCount) > i ? '●' : '○').join('')}
              </text>
            </svg>
          </div>

          <div className="flex gap-1.5 justify-center">
            <button
              onClick={onToggle}
              className="font-mono text-base border px-4 py-1 transition-colors hover:opacity-80"
              style={{ borderColor: color + '66', color }}
            >
              {isRunning ? '⏸' : '▶'}
            </button>
            <button
              onClick={onReset}
              className="font-mono text-xs border border-border text-muted hover:text-tx px-3 py-1 transition-colors"
              title="Reset timer"
            >
              ↺
            </button>
            <button
              onClick={onSkip}
              className="font-mono text-xs border border-border text-muted hover:text-tx px-3 py-1 transition-colors"
              title="Skip to next phase"
            >
              ⏭
            </button>
          </div>

          {workDone > 0 && (
            <div className="text-center mt-2 font-mono text-xs text-dim">
              {workDone} work session{workDone !== 1 ? 's' : ''} completed
            </div>
          )}
        </>
      )}
    </div>
  );
}

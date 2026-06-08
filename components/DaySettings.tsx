'use client';

import { useState } from 'react';
import { parseDayTime, formatHHMM } from '@/lib/scheduler';

interface DaySettingsProps {
  date: string;
  dayStart: string;
  dayEnd: string;
  onUpdate: (start: string, end: string) => void;
}

export default function DaySettings({ date, dayStart, dayEnd, onUpdate }: DaySettingsProps) {
  const [start, setStart] = useState(dayStart);
  const [end, setEnd] = useState(dayEnd);
  const [open, setOpen] = useState(false);

  const dayStartTime = parseDayTime(date, dayStart);
  const dayEndTime = parseDayTime(date, dayEnd);
  const totalMinutes = Math.max(0, (dayEndTime.getTime() - dayStartTime.getTime()) / 60_000);
  const totalHours = (totalMinutes / 60).toFixed(1);

  function handleApply() {
    if (start < end) {
      onUpdate(start, end);
      setOpen(false);
    }
  }

  return (
    <div className="border border-border bg-surface">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-s2 transition-colors"
      >
        <span className="font-mono text-xs text-muted tracking-widest">DAY WINDOW</span>
        <span className="font-mono text-xs text-dim">
          {dayStart} – {dayEnd} ({totalHours}h)
        </span>
      </button>

      {open && (
        <div className="px-3 py-2 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted w-16">start</span>
            <input
              type="time"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="flex-1 bg-s2 border border-border px-2 py-1 font-mono text-xs text-tx focus:outline-none focus:border-border-strong"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted w-16">end</span>
            <input
              type="time"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="flex-1 bg-s2 border border-border px-2 py-1 font-mono text-xs text-tx focus:outline-none focus:border-border-strong"
            />
          </div>
          {start >= end && (
            <p className="font-mono text-xs text-danger">end must be after start</p>
          )}
          <button
            onClick={handleApply}
            disabled={start >= end}
            className="w-full font-mono text-xs border border-accent-mid/50 text-accent hover:bg-accent-dim py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            apply
          </button>
        </div>
      )}
    </div>
  );
}

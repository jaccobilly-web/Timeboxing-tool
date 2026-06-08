'use client';

import { useEffect, useState } from 'react';
import { loadHistoricalStats } from '@/lib/stats';
import type { HistoricalStats, DayRecord } from '@/lib/stats';
import { formatDuration } from '@/lib/scheduler';

function pct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

function ratioLabel(ratio: number): string {
  if (Math.abs(ratio - 1) <= 0.02) return 'exact';
  const p = Math.round(Math.abs(ratio - 1) * 100);
  return ratio > 1 ? `+${p}% over` : `${p}% under`;
}

function ratioColor(ratio: number): string {
  if (Math.abs(ratio - 1) <= 0.1) return 'text-success';
  if (ratio > 1) return 'text-danger';
  return 'text-info';
}

interface StatCardProps { label: string; value: string; sub?: string; }
function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="border border-border p-3 bg-s2">
      <div className="font-mono text-xs text-muted tracking-widest mb-1">{label}</div>
      <div className="font-mono text-xl font-bold text-tx">{value}</div>
      {sub && <div className="font-mono text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function AccuracyBar({ under, onTime, over }: { under: number; onTime: number; over: number }) {
  const total = under + onTime + over;
  if (total === 0) return null;
  const pUnder = pct(under, total);
  const pOnTime = pct(onTime, total);
  const pOver = pct(over, total);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden border border-border">
        {pUnder > 0 && (
          <div className="bg-info/70" style={{ width: `${pUnder}%` }} title={`Under: ${under}`} />
        )}
        {pOnTime > 0 && (
          <div className="bg-success/70" style={{ width: `${pOnTime}%` }} title={`On time: ${onTime}`} />
        )}
        {pOver > 0 && (
          <div className="bg-danger/70" style={{ width: `${pOver}%` }} title={`Over: ${over}`} />
        )}
      </div>
      <div className="flex gap-4 mt-1.5">
        <span className="font-mono text-xs text-info">{pUnder}% under</span>
        <span className="font-mono text-xs text-success">{pOnTime}% on time</span>
        <span className="font-mono text-xs text-danger">{pOver}% over</span>
      </div>
    </div>
  );
}

function DayRow({ rec }: { rec: DayRecord }) {
  const ratio = rec.estimatedMinutes > 0 ? rec.actualMinutes / rec.estimatedMinutes : 1;
  const completionPct = pct(rec.tasksCompleted, rec.tasksPlanned);

  return (
    <div className="grid grid-cols-[7rem_1fr_1fr_1fr_1fr_1fr] gap-x-3 px-3 py-1.5 border-b border-border last:border-b-0 hover:bg-s2 transition-colors">
      <span className="font-mono text-xs text-muted">{rec.date}</span>
      <span className="font-mono text-xs text-tx text-right">
        {rec.tasksCompleted}/{rec.tasksPlanned}
        <span className="text-muted ml-1">({completionPct}%)</span>
      </span>
      <span className="font-mono text-xs text-muted text-right">
        {rec.overflowCount > 0 ? <span className="text-danger">{rec.overflowCount} overflow</span> : '—'}
      </span>
      <span className="font-mono text-xs text-muted text-right">{formatDuration(rec.estimatedMinutes)}</span>
      <span className="font-mono text-xs text-tx text-right">{formatDuration(rec.actualMinutes)}</span>
      <span className={`font-mono text-xs text-right ${ratioColor(ratio)}`}>
        {rec.estimatedMinutes > 0 ? ratioLabel(ratio) : '—'}
      </span>
    </div>
  );
}

interface Props { onClose: () => void; }

export default function StatsModal({ onClose }: Props) {
  const [stats, setStats] = useState<HistoricalStats | null>(null);

  useEffect(() => {
    setStats(loadHistoricalStats());
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto py-6 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl bg-bg border border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-mono text-xs tracking-widest text-muted">HISTORICAL STATS</span>
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted hover:text-tx border border-border px-2 py-0.5"
          >
            × close
          </button>
        </div>

        {!stats || stats.totalTasksCompleted === 0 ? (
          <div className="px-4 py-12 text-center font-mono text-xs text-dim">
            no completed tasks found in localStorage
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label="DAYS TRACKED" value={String(stats.totalDays)} />
              <StatCard label="TASKS DONE" value={String(stats.totalTasksCompleted)} sub={`${(stats.totalTasksCompleted / Math.max(1, stats.totalDays)).toFixed(1)} / day`} />
              <StatCard label="EST. TOTAL" value={formatDuration(stats.totalEstimatedMinutes)} />
              <StatCard label="ACTUAL TOTAL" value={formatDuration(stats.totalActualMinutes)} />
            </div>

            {/* Accuracy */}
            <div className="border border-border p-3 bg-surface space-y-3">
              <div className="font-mono text-xs text-muted tracking-widest">ESTIMATION ACCURACY</div>
              <div className="flex gap-6">
                <div>
                  <div className="font-mono text-xs text-muted">mean ratio</div>
                  <div className={`font-mono text-lg font-bold ${ratioColor(stats.overallRatio)}`}>
                    {stats.overallRatio.toFixed(2)}×
                  </div>
                  <div className="font-mono text-xs text-muted">{ratioLabel(stats.overallRatio)}</div>
                </div>
                <div>
                  <div className="font-mono text-xs text-muted">median ratio</div>
                  <div className={`font-mono text-lg font-bold ${ratioColor(stats.medianRatio)}`}>
                    {stats.medianRatio.toFixed(2)}×
                  </div>
                  <div className="font-mono text-xs text-muted">{ratioLabel(stats.medianRatio)}</div>
                </div>
              </div>
              <AccuracyBar
                under={stats.tasksUnder}
                onTime={stats.tasksOnTime}
                over={stats.tasksOver}
              />
              <div className="font-mono text-xs text-muted">
                on time = within 10% of estimate · {stats.totalTasksCompleted} tasks total
              </div>
            </div>

            {/* Day-by-day table */}
            <div className="border border-border bg-surface">
              <div className="grid grid-cols-[7rem_1fr_1fr_1fr_1fr_1fr] gap-x-3 px-3 py-2 border-b border-border">
                {['DATE', 'DONE', 'OVERFLOW', 'ESTIMATE', 'ACTUAL', 'RATIO'].map(h => (
                  <span key={h} className="font-mono text-xs text-dim tracking-wider text-right first:text-left">{h}</span>
                ))}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {stats.dayRecords.map(rec => <DayRow key={rec.date} rec={rec} />)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';

interface QuickAddProps {
  onAdd: (title: string, minutes: number) => void;
}

export default function QuickAdd({ onAdd }: QuickAddProps) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = title.trim();
    const m = parseInt(minutes, 10);
    if (!t || isNaN(m) || m < 1) return;
    onAdd(t, m);
    setTitle('');
    setMinutes('');
    titleRef.current?.focus();
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Tab' && title.trim()) {
      e.preventDefault();
      minutesRef.current?.focus();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (title.trim() && minutes) {
        handleSubmit();
      } else if (title.trim()) {
        minutesRef.current?.focus();
      }
    }
  }

  function handleMinutesKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setTitle('');
      setMinutes('');
      titleRef.current?.focus();
    }
  }

  const isValid = title.trim().length > 0 && parseInt(minutes, 10) >= 1;

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleTitleKeyDown}
        placeholder="task title"
        className="flex-1 min-w-0 bg-s2 border border-border px-2 py-1 font-mono text-xs text-tx placeholder-dim focus:outline-none focus:border-border-strong"
        maxLength={120}
        autoComplete="off"
        spellCheck={false}
      />
      <input
        ref={minutesRef}
        type="number"
        value={minutes}
        onChange={e => setMinutes(e.target.value)}
        onKeyDown={handleMinutesKeyDown}
        placeholder="min"
        className="w-14 bg-s2 border border-border px-2 py-1 font-mono text-xs text-tx placeholder-dim focus:outline-none focus:border-border-strong"
        min="1"
        max="480"
      />
      <button
        type="submit"
        disabled={!isValid}
        className="font-mono text-xs border px-2 py-1 transition-colors disabled:text-dim disabled:border-dim text-accent border-accent-mid/50 hover:bg-accent-dim"
      >
        + add
      </button>
    </form>
  );
}

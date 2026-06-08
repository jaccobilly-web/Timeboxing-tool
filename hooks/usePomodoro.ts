'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PomodoroConfig } from '@/lib/types';
import { playWorkComplete, playBreakComplete, playLongBreakComplete } from '@/lib/audio';

export type PomodoroPhase = 'work' | 'break' | 'longBreak';

export interface PomodoroState {
  phase: PomodoroPhase;
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  cycleCount: number;   // completed work cycles in this session
}

export function usePomodoro(config: PomodoroConfig) {
  const phaseSeconds = useCallback(
    (phase: PomodoroPhase) => {
      if (phase === 'work') return config.workMinutes * 60;
      if (phase === 'break') return config.breakMinutes * 60;
      return config.longBreakMinutes * 60;
    },
    [config]
  );

  const [pomState, setPomState] = useState<PomodoroState>(() => ({
    phase: 'work',
    secondsLeft: config.workMinutes * 60,
    totalSeconds: config.workMinutes * 60,
    isRunning: false,
    cycleCount: 0,
  }));

  const configRef = useRef(config);
  configRef.current = config;

  // Reset if config changes
  useEffect(() => {
    setPomState({
      phase: 'work',
      secondsLeft: config.workMinutes * 60,
      totalSeconds: config.workMinutes * 60,
      isRunning: false,
      cycleCount: 0,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.workMinutes, config.breakMinutes, config.longBreakMinutes, config.cyclesBeforeLongBreak]);

  useEffect(() => {
    if (!pomState.isRunning) return;

    const id = setInterval(() => {
      setPomState(prev => {
        if (!prev.isRunning) return prev;
        if (prev.secondsLeft > 1) {
          return { ...prev, secondsLeft: prev.secondsLeft - 1 };
        }

        // Phase complete — advance
        const cfg = configRef.current;
        let nextPhase: PomodoroPhase;
        let nextCycles = prev.cycleCount;

        if (prev.phase === 'work') {
          nextCycles = prev.cycleCount + 1;
          if (nextCycles % cfg.cyclesBeforeLongBreak === 0) {
            nextPhase = 'longBreak';
            setTimeout(playLongBreakComplete, 0);
          } else {
            nextPhase = 'break';
            setTimeout(playWorkComplete, 0);
          }
        } else {
          nextPhase = 'work';
          setTimeout(playBreakComplete, 0);
        }

        const total = phaseSeconds(nextPhase);
        return {
          phase: nextPhase,
          secondsLeft: total,
          totalSeconds: total,
          isRunning: true,
          cycleCount: nextCycles,
        };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [pomState.isRunning, phaseSeconds]);

  const toggle = useCallback(() => {
    setPomState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  }, []);

  const reset = useCallback(() => {
    setPomState(prev => ({
      ...prev,
      secondsLeft: prev.totalSeconds,
      isRunning: false,
    }));
  }, []);

  const skip = useCallback(() => {
    setPomState(prev => {
      const cfg = configRef.current;
      let nextPhase: PomodoroPhase;
      let nextCycles = prev.cycleCount;

      if (prev.phase === 'work') {
        nextCycles = prev.cycleCount + 1;
        nextPhase = nextCycles % cfg.cyclesBeforeLongBreak === 0 ? 'longBreak' : 'break';
      } else {
        nextPhase = 'work';
      }

      const total = phaseSeconds(nextPhase);
      return {
        phase: nextPhase,
        secondsLeft: total,
        totalSeconds: total,
        isRunning: false,
        cycleCount: nextCycles,
      };
    });
  }, [phaseSeconds]);

  const resetAll = useCallback(() => {
    const cfg = configRef.current;
    const total = cfg.workMinutes * 60;
    setPomState({
      phase: 'work',
      secondsLeft: total,
      totalSeconds: total,
      isRunning: false,
      cycleCount: 0,
    });
  }, []);

  return { pomState, toggle, reset, skip, resetAll };
}

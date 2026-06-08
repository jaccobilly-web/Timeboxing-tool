export type TaskStatus = 'pending' | 'active' | 'complete' | 'overflow';

export interface Task {
  id: string;
  title: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  scheduledStart?: string;   // ISO string
  scheduledEnd?: string;     // ISO string
  startedAt?: string;        // ISO string — when user clicked Start
  manualStart?: string;      // HH:MM — user-pinned start time, overrides auto-calc
  isPaused?: boolean;
  pausedAt?: string;         // ISO string — when the current pause began
  totalPausedMs?: number;    // accumulated paused milliseconds across all pauses
  status: TaskStatus;
  completedAt?: string;      // ISO string
  notes?: string;
  createdAt: string;         // ISO string
}

export interface PomodoroConfig {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export interface DayState {
  date: string;              // YYYY-MM-DD
  tasks: Task[];             // ordered agenda: complete | active | pending
  overflowTasks: Task[];     // "Not Today" bucket
  dayStart: string;          // HH:MM
  dayEnd: string;            // HH:MM
  pomodoroConfig: PomodoroConfig;
}

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

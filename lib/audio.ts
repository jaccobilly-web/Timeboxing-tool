let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

function beep(frequency: number, duration: number, gain = 0.25): void {
  const audioCtx = getCtx();
  if (!audioCtx) return;

  // Resume suspended context (required after user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const osc = audioCtx.createOscillator();
  const vol = audioCtx.createGain();

  osc.connect(vol);
  vol.connect(audioCtx.destination);

  osc.type = 'sine';
  osc.frequency.value = frequency;
  vol.gain.setValueAtTime(gain, audioCtx.currentTime);
  vol.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}

/** Work session complete → upward two-tone */
export function playWorkComplete(): void {
  beep(440, 0.15);
  setTimeout(() => beep(660, 0.25), 180);
}

/** Break complete → single mid tone */
export function playBreakComplete(): void {
  beep(528, 0.35);
}

/** Long break complete → three ascending tones */
export function playLongBreakComplete(): void {
  beep(440, 0.15);
  setTimeout(() => beep(550, 0.15), 180);
  setTimeout(() => beep(660, 0.35), 360);
}

/** Task running over → short warning blip */
export function playOverrun(): void {
  beep(880, 0.08, 0.15);
}

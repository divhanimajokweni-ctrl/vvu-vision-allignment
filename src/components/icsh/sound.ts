// src/components/icsh/sound.ts — the estate's interaction audio, synth live
// via WebAudio (no assets). Every interaction on the 4th state answers back.
// AudioContext is created lazily on the first user gesture (autoplay policy).

type Wave = 'square' | 'sawtooth' | 'triangle' | 'sine';

let ctx: AudioContext | null = null;
let soundOn = true;

export function setSoundEnabled(v: boolean): void {
  soundOn = v;
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: Wave, gain: number, delay = 0): void {
  if (!soundOn) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click: () => tone(320, 0.035, 'square', 0.045),
  tab: () => {
    tone(440, 0.03, 'square', 0.04);
    tone(660, 0.035, 'square', 0.03, 0.045);
  },
  tick: () => tone(920, 0.014, 'square', 0.03),
  ok: () => {
    tone(523, 0.06, 'square', 0.05);
    tone(784, 0.1, 'square', 0.05, 0.07);
  },
  err: () => tone(138, 0.16, 'sawtooth', 0.055),
  boot: () => {
    tone(196, 0.07, 'square', 0.04);
    tone(392, 0.07, 'square', 0.04, 0.08);
    tone(659, 0.13, 'square', 0.05, 0.16);
  },
  seal: () => {
    tone(262, 0.05, 'triangle', 0.06);
    tone(523, 0.18, 'triangle', 0.05, 0.05);
  },
  milestone: () => tone(700, 0.02, 'square', 0.035),
};

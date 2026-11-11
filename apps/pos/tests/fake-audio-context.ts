import { vi } from 'vitest';

// A fake Web Audio context on window. scan-sound keeps one shared context for the module's life, so every fake
// writes into this one log: a context made by an earlier test still records into the log the current test reads.
export const audioLog = {
  oscillators: [] as { type: string; frequency: { value: number } }[],
  // The peak ramp of each tone (linearRampToValueAtTime values other than the tail's 0).
  peaks: [] as number[],
  states: [] as string[],
  resumes: 0,
};

let initialState = 'running';

class FakeAudioContext {
  state = initialState;
  currentTime = 0;
  destination = {};
  resume(): Promise<void> {
    audioLog.resumes++;
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    const context = this;
    const oscillator = {
      type: 'sine', frequency: { value: 0 },
      connect: (node: unknown) => node, start() { audioLog.states.push(context.state); }, stop() {},
    };
    audioLog.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime(value: number) { if (value !== 0) audioLog.peaks.push(value); },
      },
      connect: (node: unknown) => node,
    };
  }
}

export function installFakeAudio(state: 'running' | 'suspended' = 'running'): void {
  audioLog.oscillators = [];
  audioLog.peaks = [];
  audioLog.states = [];
  audioLog.resumes = 0;
  initialState = state;
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

/** Each scheduled tone as `<type> <frequency>`. */
export function tones(): string[] {
  return audioLog.oscillators.map(oscillator => `${oscillator.type} ${oscillator.frequency.value}`);
}

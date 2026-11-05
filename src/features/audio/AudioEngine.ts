export type AudioChannel = 'background' | 'karaoke';

type TransitionState = {
  timer: ReturnType<typeof setTimeout>;
  resolve: (completed: boolean) => void;
};

export class AudioEngine {
  private readonly context: AudioContext;
  private readonly channelGains: Record<AudioChannel, GainNode>;
  private readonly fadeGains: Record<AudioChannel, GainNode>;
  private readonly masterGain: GainNode;
  private readonly transitions: Partial<Record<AudioChannel, TransitionState>> = {};
  private readonly transitionIds: Record<AudioChannel, number> = { background: 0, karaoke: 0 };
  private disposed = false;

  constructor(background: HTMLAudioElement, karaoke: HTMLVideoElement) {
    const Context = window.AudioContext;
    if (!Context) throw new Error('Este navegador no ofrece Web Audio API; las transiciones de audio no están disponibles.');

    this.context = new Context();
    this.channelGains = {
      background: this.context.createGain(),
      karaoke: this.context.createGain(),
    };
    this.fadeGains = {
      background: this.context.createGain(),
      karaoke: this.context.createGain(),
    };
    this.masterGain = this.context.createGain();

    this.context.createMediaElementSource(background)
      .connect(this.channelGains.background)
      .connect(this.fadeGains.background)
      .connect(this.masterGain);
    this.context.createMediaElementSource(karaoke)
      .connect(this.channelGains.karaoke)
      .connect(this.fadeGains.karaoke)
      .connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
  }

  async resume(): Promise<void> {
    if (this.disposed || this.context.state === 'closed') {
      throw new Error('El motor de audio ya fue cerrado. Recarga la aplicación para continuar.');
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setVolume(channel: AudioChannel, value: number): void {
    this.channelGains[channel].gain.setTargetAtTime(clamp(value), this.context.currentTime, 0.015);
  }

  setMasterVolume(value: number): void {
    this.masterGain.gain.setTargetAtTime(clamp(value), this.context.currentTime, 0.015);
  }

  setFadeLevel(channel: AudioChannel, value: number): void {
    this.cancelTransition(channel);
    const parameter = this.fadeGains[channel].gain;
    const now = this.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    parameter.setValueAtTime(clamp(value), now);
  }

  fadeTo(channel: AudioChannel, value: number, durationMs: number): Promise<boolean> {
    this.cancelTransition(channel);
    const parameter = this.fadeGains[channel].gain;
    const now = this.context.currentTime;
    const target = clamp(value);
    const duration = Math.max(0, durationMs);
    const id = ++this.transitionIds[channel];

    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    if (duration === 0) {
      parameter.setValueAtTime(target, now);
      return Promise.resolve(true);
    }

    parameter.linearRampToValueAtTime(target, now + duration / 1000);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.transitionIds[channel] !== id) {
          resolve(false);
          return;
        }
        delete this.transitions[channel];
        parameter.setValueAtTime(target, this.context.currentTime);
        resolve(true);
      }, duration);
      this.transitions[channel] = { timer, resolve };
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelTransition('background');
    this.cancelTransition('karaoke');
    await this.context.close();
  }

  private cancelTransition(channel: AudioChannel): void {
    const transition = this.transitions[channel];
    if (!transition) return;
    clearTimeout(transition.timer);
    delete this.transitions[channel];
    this.transitionIds[channel] += 1;
    transition.resolve(false);
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

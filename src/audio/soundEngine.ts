import { ArrowTypeId, ImpactMaterial } from '../types/archery';

export interface SpatialVec3 {
  x: number;
  y: number;
  z: number;
}

interface FlightWhistleVoice {
  noiseSource: AudioBufferSourceNode;
  whistleOsc: OscillatorNode;
  bandpass: BiquadFilterNode;
  gainNode: GainNode;
  panner: PannerNode;
}

class ArcherySoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;
  private activeWhistles: Map<number, FlightWhistleVoice> = new Map();

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private createSpatialPanner(ctx: AudioContext, pos?: SpatialVec3): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.0;
    panner.maxDistance = 110.0;
    panner.rolloffFactor = 1.1;

    const p = pos ?? { x: 0, y: 1.6, z: -0.5 };
    if (panner.positionX) {
      panner.positionX.setValueAtTime(p.x, ctx.currentTime);
      panner.positionY.setValueAtTime(p.y, ctx.currentTime);
      panner.positionZ.setValueAtTime(p.z, ctx.currentTime);
    } else {
      panner.setPosition(p.x, p.y, p.z);
    }
    panner.connect(ctx.destination);
    return panner;
  }

  public updateListener(pos: SpatialVec3, forward: SpatialVec3, up: SpatialVec3) {
    const ctx = this.ctx;
    if (!ctx || this.isMuted) return;

    const listener = ctx.listener;
    const now = ctx.currentTime;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(pos.x, now);
      listener.positionY.setValueAtTime(pos.y, now);
      listener.positionZ.setValueAtTime(pos.z, now);
      listener.forwardX.setValueAtTime(forward.x, now);
      listener.forwardY.setValueAtTime(forward.y, now);
      listener.forwardZ.setValueAtTime(forward.z, now);
      listener.upX.setValueAtTime(up.x, now);
      listener.upY.setValueAtTime(up.y, now);
      listener.upZ.setValueAtTime(up.z, now);
    } else {
      listener.setPosition(pos.x, pos.y, pos.z);
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopAllWhistles();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // 1. Spatialized Bow Draw Tension Creak & Limb Strain Tick
  public playDrawTick(tension: number, bowPos?: SpatialVec3) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, bowPos);

    // Tactile wood-laminate strain creak
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 115 + tension * 210;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.68, now + 0.045);

    gain.gain.setValueAtTime(0.055 + tension * 0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(now);
    osc.stop(now + 0.05);

    // Subtle string fiber friction chirp above 50% draw
    if (tension > 0.5) {
      const friction = ctx.createBufferSource();
      friction.buffer = this.getNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600 + tension * 1200, now);
      bp.Q.value = 4.5;

      const fGain = ctx.createGain();
      fGain.gain.setValueAtTime(0.025 * tension, now);
      fGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      friction.connect(bp);
      bp.connect(fGain);
      fGain.connect(panner);
      friction.start(now);
      friction.stop(now + 0.04);
    }
  }

  // Nock click when switching arrow type
  public playArrowSelect(type: ArrowTypeId) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freqMap: Record<ArrowTypeId, number> = {
      standard: 520,
      explosive: 340,
      ice: 780,
      shock: 660,
      split: 590,
    };

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqMap[type], now);
    osc.frequency.exponentialRampToValueAtTime(freqMap[type] * 1.25, now + 0.07);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  // 2. Spatialized Bowstring Release Snap + Limb Resonance
  public playArrowRelease(tension: number, type: ArrowTypeId, releasePos?: SpatialVec3) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, releasePos);

    // Bowstring harmonic twang
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === 'shock' ? 'sawtooth' : 'triangle';
    const startFreq = 140 + tension * 105;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.19);

    gain.gain.setValueAtTime(0.2 * Math.max(0.3, tension), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(now);
    osc.stop(now + 0.21);

    // Filtered initial air displacement burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950 + tension * 1300, now);
    filter.Q.value = 1.6;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15 * tension, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(panner);
    noise.start(now);
    noise.stop(now + 0.17);
  }

  // 3. Continuous Spatialized Arrow Flight Whistle (velocity- & distance-modulated)
  public startArrowFlightWhistle(
    arrowId: number,
    type: ArrowTypeId,
    pos: SpatialVec3,
    speed: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.activeWhistles.has(arrowId)) {
      this.stopArrowFlightWhistle(arrowId);
    }

    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, pos);

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.getNoiseBuffer(ctx);
    noiseSource.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    const speedFactor = Math.min(1, Math.max(0.1, speed / 68));
    const baseWhistleFreq = type === 'shock' ? 1480 : type === 'ice' ? 1280 : 960;
    bandpass.frequency.setValueAtTime(baseWhistleFreq * (0.6 + speedFactor * 0.65), now);
    bandpass.Q.value = 7.5;

    // Subtle aerodynamic fletching whistle harmonic
    const whistleOsc = ctx.createOscillator();
    whistleOsc.type = 'sine';
    whistleOsc.frequency.setValueAtTime(baseWhistleFreq * (0.7 + speedFactor * 0.5), now);

    const oscTrim = ctx.createGain();
    oscTrim.gain.setValueAtTime(0.14, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.085 * speedFactor, now + 0.04);

    noiseSource.connect(bandpass);
    bandpass.connect(gainNode);
    whistleOsc.connect(oscTrim);
    oscTrim.connect(gainNode);
    gainNode.connect(panner);

    noiseSource.start(now);
    whistleOsc.start(now);

    this.activeWhistles.set(arrowId, {
      noiseSource,
      whistleOsc,
      bandpass,
      gainNode,
      panner,
    });
  }

  public updateArrowFlightWhistle(arrowId: number, pos: SpatialVec3, speed: number) {
    const voice = this.activeWhistles.get(arrowId);
    const ctx = this.ctx;
    if (!voice || !ctx || this.isMuted) return;

    const now = ctx.currentTime;
    if (voice.panner.positionX) {
      voice.panner.positionX.setValueAtTime(pos.x, now);
      voice.panner.positionY.setValueAtTime(pos.y, now);
      voice.panner.positionZ.setValueAtTime(pos.z, now);
    } else {
      voice.panner.setPosition(pos.x, pos.y, pos.z);
    }

    const speedFactor = Math.min(1, Math.max(0.05, speed / 68));
    voice.bandpass.frequency.setTargetAtTime(620 + speedFactor * 1120, now, 0.03);
    voice.whistleOsc.frequency.setTargetAtTime(680 + speedFactor * 940, now, 0.03);
    voice.gainNode.gain.setTargetAtTime(0.085 * speedFactor, now, 0.03);
  }

  public stopArrowFlightWhistle(arrowId: number) {
    const voice = this.activeWhistles.get(arrowId);
    if (!voice) return;
    this.activeWhistles.delete(arrowId);

    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    try {
      voice.gainNode.gain.setTargetAtTime(0.0001, now, 0.015);
      voice.noiseSource.stop(now + 0.06);
      voice.whistleOsc.stop(now + 0.06);
    } catch {
      // Ignore already stopped sources
    }
  }

  public stopAllWhistles() {
    Array.from(this.activeWhistles.keys()).forEach((id) => {
      this.stopArrowFlightWhistle(id);
    });
  }

  // Mid-air Chrono-Split bifurcation sound
  public playSplitBifurcation(pos?: SpatialVec3) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, pos);

    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.02);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + idx * 0.02 + 0.11);

      gain.gain.setValueAtTime(0.08, now + idx * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.02 + 0.12);

      osc.connect(gain);
      gain.connect(panner);
      osc.start(now + idx * 0.02);
      osc.stop(now + idx * 0.02 + 0.13);
    });
  }

  // 4. Spatialized Material-Specific Impacts (Wood / Stone / Metal) + Elemental Payload
  public playMaterialImpact(
    material: ImpactMaterial,
    worldPos: SpatialVec3,
    arrowType: ArrowTypeId,
    isBullseye: boolean,
    impactSpeed: number = 45
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, worldPos);
    const speedGain = Math.min(1.2, Math.max(0.35, impactSpeed / 55));

    if (material === 'wood') {
      // Hollow timber thud + dry wood fiber crack
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(165, now);
      thudOsc.frequency.exponentialRampToValueAtTime(48, now + 0.12);
      thudGain.gain.setValueAtTime(0.28 * speedGain, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      thudOsc.connect(thudGain);
      thudGain.connect(panner);
      thudOsc.start(now);
      thudOsc.stop(now + 0.14);

      const crack = ctx.createBufferSource();
      crack.buffer = this.getNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1350, now);
      bp.Q.value = 2.2;
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.18 * speedGain, now);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      crack.connect(bp);
      bp.connect(cGain);
      cGain.connect(panner);
      crack.start(now);
      crack.stop(now + 0.07);
    } else if (material === 'stone') {
      // Dense granite crunch + high-frequency mineral chip ricochet
      const stoneOsc = ctx.createOscillator();
      const stoneGain = ctx.createGain();
      stoneOsc.type = 'sine';
      stoneOsc.frequency.setValueAtTime(105, now);
      stoneOsc.frequency.exponentialRampToValueAtTime(32, now + 0.11);
      stoneGain.gain.setValueAtTime(0.26 * speedGain, now);
      stoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      stoneOsc.connect(stoneGain);
      stoneGain.connect(panner);
      stoneOsc.start(now);
      stoneOsc.stop(now + 0.13);

      // Sharp stone chip ping
      const pingOsc = ctx.createOscillator();
      const pingGain = ctx.createGain();
      pingOsc.type = 'triangle';
      pingOsc.frequency.setValueAtTime(2950, now);
      pingOsc.frequency.exponentialRampToValueAtTime(1420, now + 0.08);
      pingGain.gain.setValueAtTime(0.16 * speedGain, now);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      pingOsc.connect(pingGain);
      pingGain.connect(panner);
      pingOsc.start(now);
      pingOsc.stop(now + 0.095);

      // Gritty rubble scatter tail
      const grit = ctx.createBufferSource();
      grit.buffer = this.getNoiseBuffer(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(2200, now);
      const gGain = ctx.createGain();
      gGain.gain.setValueAtTime(0.14 * speedGain, now);
      gGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      grit.connect(hp);
      hp.connect(gGain);
      gGain.connect(panner);
      grit.start(now);
      grit.stop(now + 0.17);
    } else if (material === 'metal') {
      // Resonant steel clang using inharmonic modal partials
      const partials = [420, 685, 1140, 1790];
      partials.forEach((freq, idx) => {
        const mOsc = ctx.createOscillator();
        const mGain = ctx.createGain();
        mOsc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        mOsc.frequency.setValueAtTime(freq, now);
        mOsc.frequency.exponentialRampToValueAtTime(freq * 0.985, now + 0.52);

        const amp = (0.16 / (idx + 1)) * speedGain;
        mGain.gain.setValueAtTime(amp, now);
        mGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.55 - idx * 0.07);

        mOsc.connect(mGain);
        mGain.connect(panner);
        mOsc.start(now);
        mOsc.stop(now + 0.56);
      });
    }

    // Layer elemental payload acoustics
    if (arrowType === 'explosive') {
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(95, now);
      subOsc.frequency.exponentialRampToValueAtTime(24, now + 0.45);

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(240, now);

      subGain.gain.setValueAtTime(0.32, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

      subOsc.connect(lowpass);
      lowpass.connect(subGain);
      subGain.connect(panner);
      subOsc.start(now);
      subOsc.stop(now + 0.48);
    } else if (arrowType === 'ice') {
      [1174.66, 1567.98, 2093.0].forEach((freq, i) => {
        const iceOsc = ctx.createOscillator();
        const iceGain = ctx.createGain();
        iceOsc.type = 'triangle';
        iceOsc.frequency.setValueAtTime(freq, now + i * 0.03);
        iceOsc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + i * 0.03 + 0.22);

        iceGain.gain.setValueAtTime(0.09, now + i * 0.03);
        iceGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.24);

        iceOsc.connect(iceGain);
        iceGain.connect(panner);
        iceOsc.start(now + i * 0.03);
        iceOsc.stop(now + i * 0.03 + 0.25);
      });
    } else if (arrowType === 'shock') {
      const zapOsc = ctx.createOscillator();
      const zapGain = ctx.createGain();
      zapOsc.type = 'sawtooth';
      zapOsc.frequency.setValueAtTime(880, now);
      zapOsc.frequency.linearRampToValueAtTime(220, now + 0.08);
      zapOsc.frequency.linearRampToValueAtTime(1240, now + 0.16);
      zapOsc.frequency.exponentialRampToValueAtTime(140, now + 0.26);

      zapGain.gain.setValueAtTime(0.14, now);
      zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);

      zapOsc.connect(zapGain);
      zapGain.connect(panner);
      zapOsc.start(now);
      zapOsc.stop(now + 0.28);
    }

    if (isBullseye) {
      const bellOsc = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bellOsc.type = 'sine';
      bellOsc.frequency.setValueAtTime(880, now + 0.04);
      bellOsc.frequency.setValueAtTime(1318.5, now + 0.11);

      bellGain.gain.setValueAtTime(0.14, now + 0.04);
      bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      bellOsc.connect(bellGain);
      bellGain.connect(panner);
      bellOsc.start(now + 0.04);
      bellOsc.stop(now + 0.44);
    }
  }
}

export const soundEngine = new ArcherySoundEngine();

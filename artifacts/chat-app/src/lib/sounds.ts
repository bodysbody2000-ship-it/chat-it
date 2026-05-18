// Sound effects generated programmatically via Web Audio API
// No external files needed — works instantly

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // Resume if browser suspended it (autoplay policy)
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Whoosh — played when YOU send a message */
export function playSend(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;

    // Oscillator: descending sine sweep
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.18);

    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 0.8;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.start(now);
    osc.stop(now + 0.25);

    // Short air-rush noise layer
    const bufferSize = ac.sampleRate * 0.15;
    const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.06;

    const noiseSource = ac.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseGain = ac.createGain();
    const noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1200;

    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ac.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 0.18);
  } catch {
    /* silent if browser blocks audio */
  }
}

/** Ping — played when someone ELSE sends a message */
export function playReceive(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;

    // Two-tone chime
    const tones = [
      { freq: 1046.5, delay: 0,    dur: 0.35 },  // C6
      { freq: 1318.5, delay: 0.08, dur: 0.3  },  // E6
    ];

    tones.forEach(({ freq, delay, dur }) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.14, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.05);
    });
  } catch {
    /* silent if browser blocks audio */
  }
}

'use strict';
// Short synthesized effects: no downloads, audio assets, or background music.
const sound = (() => {
  let context, output;
  const sources = new Set();
  let enabled = true;
  try { enabled = localStorage.getItem('cardflip-sound') !== 'off'; } catch {}
  function stop() {
    for (const source of sources) { try { source.stop(); } catch {} }
    sources.clear();
  }
  function unlock() {
    if (!enabled) return;
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        output = context.createGain();
        output.gain.value = 0.35;
        output.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Audio unavailable: the game remains playable. */ }
  }
  function track(source, nodes, time, duration) {
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      nodes.forEach(node => node.disconnect());
    };
    source.start(time);
    source.stop(time + duration);
  }
  function note(frequency, time, duration, volume = 0.2, type = 'sine', endFrequency = frequency) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain); gain.connect(output);
    track(oscillator, [gain], time, duration + 0.01);
  }
  function swish(time) {
    const duration = 0.13;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.65;
    filter.frequency.setValueAtTime(1800, time);
    filter.frequency.exponentialRampToValueAtTime(450, time + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(output);
    track(source, [filter, gain], time, duration);
  }
  function play(effect, delay = 0) {
    if (!enabled || !context || context.state !== 'running') return;
    try {
      const t = context.currentTime + delay;
      if (effect === 'click') note(620, t, 0.045, 0.22, 'triangle', 180);
      if (effect === 'flip') swish(t);
      if (effect === 'match') [659.25, 880, 1108.73].forEach((f, i) => note(f, t + i * 0.075, 0.28, 0.17));
      if (effect === 'miss') {
        note(293.66, t, 0.13, 0.16, 'triangle');
        note(220, t + 0.11, 0.22, 0.13, 'triangle');
      }
      if (effect === 'clear') {
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => note(f, t + i * 0.115, 0.42, 0.16));
        [523.25, 659.25, 783.99, 1046.5].forEach(f => note(f, t + 0.65, 0.65, 0.09));
      }
    } catch { /* A sound failure must never interrupt card selection. */ }
  }
  return {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = value;
      if (!enabled) stop();
      try { localStorage.setItem('cardflip-sound', enabled ? 'on' : 'off'); } catch {}
      if (enabled) unlock();
    },
    unlock, play, stop
  };
})();

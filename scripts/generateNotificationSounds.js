import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../public/sounds');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const SAMPLE_RATE = 44100;

function createWavBuffer(samples, sampleRate = SAMPLE_RATE) {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1]
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intVal = s < 0 ? Math.floor(s * 32768) : Math.min(32767, Math.floor(s * 32767));
    buffer.writeInt16LE(intVal, offset);
    offset += 2;
  }

  return buffer;
}

// 1. Messenger Pop (Bong bóng vui nhộn)
function generatePop() {
  const duration = 0.12;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);
  let phase = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Pitch sweep from 420Hz to 950Hz
    const freq = 420 + 530 * Math.pow(progress, 0.7);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;

    // Fast attack (4ms), exponential decay
    const env = t < 0.005 ? (t / 0.005) : Math.exp(-t * 30);
    // Sine fundamental + slight 2nd harmonic
    const wave = Math.sin(phase) + 0.25 * Math.sin(phase * 2);
    samples[i] = wave * env * 0.75;
  }
  return samples;
}

// 2. Chime (Tinh tinh kép trong trẻo)
function generateChime() {
  const duration = 0.42;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { start: 0.00, freq: 1318.5, dur: 0.20, vol: 0.65 }, // E6
    { start: 0.09, freq: 1760.0, dur: 0.32, vol: 0.85 }, // A6
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    for (const note of notes) {
      if (t >= note.start) {
        const localT = t - note.start;
        const env = localT < 0.004 ? (localT / 0.004) : Math.exp(-localT * 12);
        const p = 2 * Math.PI * note.freq * localT;
        // Bell timbre: fundamental + overtone
        const tone = Math.sin(p) + 0.3 * Math.sin(p * 2.4) + 0.15 * Math.sin(p * 3.8);
        s += tone * env * note.vol;
      }
    }
    samples[i] = s * 0.55;
  }
  return samples;
}

// 3. Ding Dong (Chuông đôi ngân vang)
function generateDingDong() {
  const duration = 0.65;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { start: 0.00, freq: 1046.5, vol: 0.75, decay: 9 },  // C6 (Ding)
    { start: 0.20, freq: 783.99, vol: 0.85, decay: 7 },  // G5 (Dong)
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    for (const note of notes) {
      if (t >= note.start) {
        const localT = t - note.start;
        const env = localT < 0.005 ? (localT / 0.005) : Math.exp(-localT * note.decay);
        const p = 2 * Math.PI * note.freq * localT;
        // Warm tube chime tone
        const tone = Math.sin(p) + 0.22 * Math.sin(p * 2) + 0.08 * Math.sin(p * 3);
        s += tone * env * note.vol;
      }
    }
    samples[i] = s * 0.55;
  }
  return samples;
}

// 4. Subtle Ping (Tút ngắn tinh tế / Slack style)
function generatePing() {
  const duration = 0.16;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = t < 0.003 ? (t / 0.003) : Math.exp(-t * 22);
    const p = 2 * Math.PI * 987.77 * t; // B5
    const tone = Math.sin(p) + 0.18 * Math.sin(p * 2);
    samples[i] = tone * env * 0.65;
  }
  return samples;
}

// 5. Marimba (Gõ phím gỗ vui tươi / Telegram style)
function generateMarimba() {
  const duration = 0.45;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { start: 0.00, freq: 523.25, vol: 0.65 }, // C5
    { start: 0.07, freq: 659.25, vol: 0.70 }, // E5
    { start: 0.14, freq: 783.99, vol: 0.80 }, // G5
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    for (const note of notes) {
      if (t >= note.start) {
        const localT = t - note.start;
        const env = localT < 0.003 ? (localT / 0.003) : Math.exp(-localT * 18);
        const p = 2 * Math.PI * note.freq * localT;
        // Wooden bar harmonic: fundamental + high wooden transient
        const click = localT < 0.008 ? Math.sin(localT * 12000) * 0.3 : 0;
        const tone = Math.sin(p) + 0.25 * Math.sin(p * 3) + click;
        s += tone * env * note.vol;
      }
    }
    samples[i] = s * 0.55;
  }
  return samples;
}

// 6. Harp Bell (Chuông hạc cầm ngân vang / Thông báo hệ thống)
function generateHarpBell() {
  const duration = 0.65;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { start: 0.00, freq: 1174.66, vol: 0.55 }, // D6
    { start: 0.08, freq: 1479.98, vol: 0.65 }, // F#6
    { start: 0.16, freq: 1760.00, vol: 0.80 }, // A6
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    for (const note of notes) {
      if (t >= note.start) {
        const localT = t - note.start;
        const env = localT < 0.004 ? (localT / 0.004) : Math.exp(-localT * 8);
        const p = 2 * Math.PI * note.freq * localT;
        const tone = Math.sin(p) + 0.25 * Math.sin(p * 2.02) + 0.12 * Math.sin(p * 3.01);
        s += tone * env * note.vol;
      }
    }
    samples[i] = s * 0.5;
  }
  return samples;
}

const sounds = [
  { name: 'pop.wav', gen: generatePop },
  { name: 'chime.wav', gen: generateChime },
  { name: 'dingdong.wav', gen: generateDingDong },
  { name: 'ping.wav', gen: generatePing },
  { name: 'marimba.wav', gen: generateMarimba },
  { name: 'harp-bell.wav', gen: generateHarpBell },
];

for (const { name, gen } of sounds) {
  const samples = gen();
  const buffer = createWavBuffer(samples);
  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

console.log('All 6 notification sounds generated successfully!');

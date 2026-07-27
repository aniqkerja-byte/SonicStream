const fs = require('fs');
const path = require('path');

function createWavBuffer(durationSeconds, sampleRate, noteFrequencies) {
  const numChannels = 2;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = durationSeconds * sampleRate;
  const subChunk2Size = numSamples * blockAlign;
  const chunkSize = 36 + subChunk2Size;

  const buffer = Buffer.alloc(44 + subChunk2Size);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(chunkSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(subChunk2Size, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    
    // Envelope (fade in and fade out)
    let env = 1;
    if (t < 1) env = t;
    if (t > durationSeconds - 1) env = Math.max(0, durationSeconds - t);

    // Synthesis chords
    let leftSample = 0;
    let rightSample = 0;

    noteFrequencies.forEach((freq, idx) => {
      const beat = Math.floor(t * 2); // 120 BPM tempo pulse
      const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI * 4);
      const wave = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t);
      const pan = (idx % 2 === 0) ? 0.7 : 0.3;
      leftSample += wave * pulse * pan;
      rightSample += wave * pulse * (1 - pan);
    });

    leftSample = Math.max(-1, Math.min(1, (leftSample / noteFrequencies.length) * 0.5 * env));
    rightSample = Math.max(-1, Math.min(1, (rightSample / noteFrequencies.length) * 0.5 * env));

    const leftInt = Math.floor(leftSample * 32767);
    const rightInt = Math.floor(rightSample * 32767);

    buffer.writeInt16LE(leftInt, offset);
    buffer.writeInt16LE(rightInt, offset + 2);
    offset += 4;
  }

  return buffer;
}

const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });

const tracks = [
  {
    filename: 'Midnight_Chords.wav',
    duration: 15,
    notes: [261.63, 329.63, 392.00, 523.25] // C Major 7
  },
  {
    filename: 'Synthwave_Vibes.wav',
    duration: 18,
    notes: [220.00, 261.63, 329.63, 440.00] // A Minor
  },
  {
    filename: 'Sunset_LoFi.wav',
    duration: 12,
    notes: [174.61, 220.00, 261.63, 349.23] // F Major
  }
];

tracks.forEach(track => {
  const filePath = path.join(musicDir, track.filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Generating sample track: ${track.filename}`);
    const buf = createWavBuffer(track.duration, 44100, track.notes);
    fs.writeFileSync(filePath, buf);
  }
});
console.log('Sample tracks generated successfully!');

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SOURCE_DIR = "src/assets";
const OUTPUT_DIR = "src/assets/enhanced";
const SAMPLE_RATE = 22050;
const TARGET_RMS_DB = -20;
const FRAME_SECONDS = 0.01;
const ACTIVE_RANGE_DB = 30;
const MAX_BUFFER = 64 * 1024 * 1024;
const MIN_DENOISE_SECONDS = 0.1;
const LEVEL_OFFSETS_DB = { "bowlback.wav": -10 };

const BASE_FILTERS = [`aresample=${SAMPLE_RATE}:resampler=soxr`, "highpass=f=70", "lowpass=f=5000"];
const DENOISE_FILTER = "afftdn=nr=18:nf=-40:tn=1";

function durationSeconds(path) {
  const args = ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path];
  const output = execFileSync("ffprobe", args);
  const text = output.toString();

  return Number(text);
}

function cleanupFilters(path) {
  const duration = durationSeconds(path);

  if (duration < MIN_DENOISE_SECONDS) {
    return BASE_FILTERS.join(",");
  }

  return [...BASE_FILTERS, DENOISE_FILTER].join(",");
}

function finishingFilters(gainDb) {
  return [
    `volume=${gainDb}dB`,
    "alimiter=limit=0.89:attack=2:release=40:level=false:latency=true",
    "afade=t=in:d=0.003",
    "areverse",
    "afade=t=in:d=0.008",
    "areverse",
  ].join(",");
}

function decodeCleaned(path) {
  const filters = cleanupFilters(path);
  const args = ["-v", "error", "-i", path, "-af", filters, "-ac", "1", "-f", "f32le", "-"];
  const output = execFileSync("ffmpeg", args, { maxBuffer: MAX_BUFFER });
  const start = output.byteOffset;
  const end = start + output.byteLength;
  const copy = output.buffer.slice(start, end);

  return new Float32Array(copy);
}

function frameMeanSquares(samples) {
  const frameSize = Math.round(SAMPLE_RATE * FRAME_SECONDS);
  const frameCount = Math.ceil(samples.length / frameSize);

  return Array.from({ length: frameCount }, (_, index) => {
    const start = index * frameSize;
    const frame = samples.subarray(start, start + frameSize);
    const sum = frame.reduce((total, sample) => total + sample * sample, 0);

    return sum / frame.length;
  });
}

function activeRmsDb(samples) {
  const frames = frameMeanSquares(samples);
  const loudest = Math.max(...frames);
  const threshold = loudest * 10 ** (-ACTIVE_RANGE_DB / 10);
  const active = frames.filter((meanSquare) => meanSquare >= threshold);
  const total = active.reduce((sum, meanSquare) => sum + meanSquare, 0);
  const mean = total / active.length;

  return 10 * Math.log10(mean);
}

function encode(samples, gainDb, path) {
  const filters = finishingFilters(gainDb);
  const rate = String(SAMPLE_RATE);
  const args = ["-v", "error", "-y", "-f", "f32le", "-ar", rate, "-ac", "1", "-i", "-"];
  const outputArgs = ["-af", filters, "-c:a", "pcm_s16le", path];
  const input = Buffer.from(samples.buffer);

  execFileSync("ffmpeg", [...args, ...outputArgs], { input });
}

function enhance(file) {
  const sourcePath = join(SOURCE_DIR, file);
  const outputPath = join(OUTPUT_DIR, file);
  const samples = decodeCleaned(sourcePath);
  const measuredDb = activeRmsDb(samples);
  const offsetDb = LEVEL_OFFSETS_DB[file] ?? 0;
  const gainDb = TARGET_RMS_DB + offsetDb - measuredDb;

  encode(samples, gainDb, outputPath);

  const measured = measuredDb.toFixed(1);
  const gain = gainDb.toFixed(1);

  console.log(`${file}: ${measured} dB -> gain ${gain} dB`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const files = readdirSync(SOURCE_DIR).filter((file) => file.endsWith(".wav"));

for (const file of files) {
  enhance(file);
}

import { decodeBitmap, mirrorBitmap, shrinkBitmap, type DecodedBitmap } from "./bitmap";
import { BitmapCast, QuarterCast, type Drawable } from "./cast";
import type { KnockTables } from "./knockdown";
import embeddedData from "./assets/data.json";

const assetUrls = import.meta.glob<string>("./assets/*.{bmp,wav}", {
  query: "?url",
  import: "default",
  eager: true,
});

const QUARTER_PREFIX = "#";
const COPY_PREFIX = "~";
const QUARTER_FACTOR = 4;
const MIRROR_SUFFIX = "rx.bmp";

export interface LayoutRecord {
  name: string;
  x: number;
  y: number;
  flags: number;
}

export interface CreditsData {
  intro: string[];
  crewCredits: string[][];
  headX: number[];
  headY: number[];
}

export interface GameData extends KnockTables {
  credits: CreditsData;
  story: string[];
  rules: string[];
  ballScale: number[];
}

interface EmbeddedData {
  layout: LayoutRecord[];
  data: GameData;
}

function fileNameOf(path: string): string {
  const slash = path.lastIndexOf("/");

  return path.slice(slash + 1).toLowerCase();
}

export class Assets {
  readonly layout: LayoutRecord[];
  readonly data: GameData;
  private readonly bitmaps = new Map<string, DecodedBitmap>();
  private readonly casts = new Map<string, Drawable>();
  private readonly sounds = new Map<string, AudioBuffer>();

  private constructor(embedded: EmbeddedData) {
    this.layout = embedded.layout;
    this.data = embedded.data;
  }

  static async load(audio: AudioContext, onProgress: (fraction: number) => void): Promise<Assets> {
    const assets = new Assets(embeddedData as EmbeddedData);
    const entries = Object.entries(assetUrls);
    const total = entries.length;
    const loaded = new Set<string>();

    const loadOne = async ([path, url]: [string, string]) => {
      const file = fileNameOf(path);

      await assets.loadAsset(audio, file, url);
      loaded.add(file);
      onProgress(loaded.size / total);
    };

    const pending = entries.map(loadOne);

    await Promise.all(pending);

    return assets;
  }

  private async loadAsset(audio: AudioContext, file: string, url: string): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Could not load ${file} (HTTP ${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    const isSound = file.endsWith(".wav");

    if (isSound) {
      const decoded = await audio.decodeAudioData(buffer);

      this.sounds.set(file, decoded);
      return;
    }

    const bitmap = decodeBitmap(buffer);

    this.bitmaps.set(file, bitmap);
  }

  cast(name: string): Drawable {
    const key = name.toLowerCase();
    const cached = this.casts.get(key);

    if (cached) {
      return cached;
    }

    const created = this.createCast(name, key);

    this.casts.set(key, created);

    return created;
  }

  private createCast(name: string, key: string): Drawable {
    const bitmap = this.resolveBitmap(key);
    const isQuarter = key.startsWith(QUARTER_PREFIX);

    if (!isQuarter) {
      return new BitmapCast(name, bitmap);
    }

    const fullSize = this.resolveBitmap(key.slice(1));

    return new QuarterCast(name, fullSize, bitmap);
  }

  private resolveBitmap(key: string): DecodedBitmap {
    const direct = this.bitmaps.get(key);

    if (direct) {
      return direct;
    }

    if (key.startsWith(COPY_PREFIX)) {
      return this.resolveBitmap(key.slice(1));
    }

    if (key.startsWith(QUARTER_PREFIX)) {
      const fullSize = this.resolveBitmap(key.slice(1));
      const quarter = shrinkBitmap(fullSize, QUARTER_FACTOR);

      this.bitmaps.set(key, quarter);

      return quarter;
    }

    if (key.endsWith(MIRROR_SUFFIX)) {
      const baseName = key.slice(0, -MIRROR_SUFFIX.length) + ".bmp";
      const original = this.resolveBitmap(baseName);
      const mirrored = mirrorBitmap(original);

      this.bitmaps.set(key, mirrored);

      return mirrored;
    }

    throw new Error(`AddCast - cannot find cast ${key}`);
  }

  sound(name: string): AudioBuffer {
    const key = name.toLowerCase();
    const buffer = this.sounds.get(key);

    if (!buffer) {
      throw new Error(`Could not find sound ${name}`);
    }

    return buffer;
  }
}

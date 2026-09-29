import { transparencyMask, type DecodedBitmap } from "./bitmap";

export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface CastSurface {
  canvas: HTMLCanvasElement;
  mask: Uint8Array | null;
  bbox: Rect;
}

export interface Drawable {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly hotspotX: number;
  readonly hotspotY: number;
  mode: number;
  surface(): CastSurface;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  return canvas;
}

function isRowOpaque(mask: Uint8Array, width: number, row: number): boolean {
  const start = row * width;
  const pixels = mask.subarray(start, start + width);

  return pixels.includes(0);
}

function isColumnOpaque(mask: Uint8Array, width: number, height: number, column: number): boolean {
  for (let row = 0; row < height; row++) {
    if (mask[row * width + column] === 0) {
      return true;
    }
  }

  return false;
}

function opaqueBoundingBox(mask: Uint8Array, width: number, height: number): Rect {
  const rows = Array.from({ length: height }, (_, row) => isRowOpaque(mask, width, row));
  const columns = Array.from({ length: width }, (_, column) =>
    isColumnOpaque(mask, width, height, column),
  );
  const top = rows.indexOf(true);

  if (top === -1) {
    return { l: 0, t: 0, r: 0, b: 0 };
  }

  const bottom = rows.lastIndexOf(true) + 1;
  const left = columns.indexOf(true);
  const right = columns.lastIndexOf(true) + 1;

  return { l: left, t: top, r: right, b: bottom };
}

export class BitmapCast implements Drawable {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly hotspotX: number;
  readonly hotspotY: number;
  mode = 0;
  private readonly bitmap: DecodedBitmap;
  private readonly surfaces = new Map<number, CastSurface>();

  constructor(name: string, bitmap: DecodedBitmap) {
    this.name = name;
    this.bitmap = bitmap;
    this.width = bitmap.width;
    this.height = bitmap.height;
    this.hotspotX = bitmap.width >> 1;
    this.hotspotY = bitmap.height >> 1;
  }

  surface(): CastSurface {
    const cached = this.surfaces.get(this.mode);

    if (cached) {
      return cached;
    }

    const created = this.buildSurface(this.mode);

    this.surfaces.set(this.mode, created);

    return created;
  }

  private buildSurface(mode: number): CastSurface {
    const { width, height } = this.bitmap;
    const mask = transparencyMask(this.bitmap, mode);
    const pixels = new Uint8ClampedArray(this.bitmap.pixels);

    for (let pixel = 0; pixel < mask.length; pixel++) {
      if (mask[pixel] === 1) {
        pixels[pixel * 4 + 3] = 0;
      }
    }

    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    const imageData = new ImageData(pixels, width, height);

    context.putImageData(imageData, 0, 0);

    const bbox =
      mode === 0 ? { l: 0, t: 0, r: width, b: height } : opaqueBoundingBox(mask, width, height);
    const hitMask = mode === 0 ? null : mask;

    return { canvas, mask: hitMask, bbox };
  }
}

export interface FontSpec {
  family: string;
  size: number;
  weight: number;
  italic: boolean;
}

const FONTS: FontSpec[] = [
  { family: "Arial, Helvetica, sans-serif", size: 16, weight: 700, italic: false },
  { family: "Arial, Helvetica, sans-serif", size: 44, weight: 700, italic: false },
  { family: "Arial, Helvetica, sans-serif", size: 14, weight: 700, italic: false },
  { family: "Arial, Helvetica, sans-serif", size: 16, weight: 300, italic: false },
  {
    family: "'Lucida Handwriting', 'Brush Script MT', cursive",
    size: 19,
    weight: 600,
    italic: true,
  },
  {
    family: "'Lucida Calligraphy', 'Apple Chancery', cursive",
    size: 19,
    weight: 600,
    italic: true,
  },
  { family: "Arial, Helvetica, sans-serif", size: 20, weight: 700, italic: false },
];

function fontCss(font: FontSpec): string {
  const style = font.italic ? "italic" : "normal";
  const pixelSize = Math.round(font.size / 1.15);

  return `${style} ${font.weight} ${pixelSize}px ${font.family}`;
}

function colorCss(color: number): string {
  if (color === 0xffffff) {
    return "rgb(240,240,240)";
  }

  const red = color & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = (color >> 16) & 0xff;

  return `rgb(${red},${green},${blue})`;
}

function wrapLine(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines = [""];

  for (const word of words) {
    const lastIndex = lines.length - 1;
    const current = lines[lastIndex];
    const candidate = current === "" ? word : `${current} ${word}`;
    const fits = context.measureText(candidate).width <= maxWidth;

    if (fits || current === "") {
      lines[lastIndex] = candidate;
      continue;
    }

    lines.push(word);
  }

  return lines;
}

export class TextCast implements Drawable {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly hotspotX: number;
  readonly hotspotY: number;
  mode: number;
  font = 0;
  color = 0;
  lineHeight = 0;
  private cursorY = 0;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private cachedSurface: CastSurface | null = null;

  constructor(name: string, width: number, height: number, mode: number) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.hotspotX = width >> 1;
    this.hotspotY = height >> 1;
    this.mode = mode;
    this.canvas = createCanvas(width, height);
    this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
  }

  clear(): void {
    this.context.clearRect(0, 0, this.width, this.height);
    this.cursorY = 0;
    this.cachedSurface = null;
  }

  setText(text: string): void {
    this.clear();
    this.appendText(text);
  }

  appendText(text: string): void {
    const font = FONTS[this.font];
    const context = this.context;
    const paragraphs = text.split("\r");
    const startY = this.cursorY;

    context.font = fontCss(font);
    context.fillStyle = colorCss(this.color);
    context.textAlign = "center";
    context.textBaseline = "middle";

    const centerX = this.width / 2;

    for (const paragraph of paragraphs) {
      const lines = wrapLine(context, paragraph, this.width);

      for (const line of lines) {
        const middle = this.cursorY + font.size / 2;

        context.fillText(line, centerX, middle);
        this.cursorY += font.size;
      }
    }

    this.lineHeight = this.cursorY - startY;
    this.cachedSurface = null;
  }

  surface(): CastSurface {
    if (this.cachedSurface) {
      return this.cachedSurface;
    }

    const bbox = { l: 0, t: 0, r: this.width, b: this.height };

    this.cachedSurface = { canvas: this.canvas, mask: null, bbox };

    return this.cachedSurface;
  }
}

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

const MIN_TEXT_RESOLUTION = 4;
const STAGE_WIDTH = 640;
const STAGE_HEIGHT = 480;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  return canvas;
}

function textResolution(): number {
  const pixelRatio = window.devicePixelRatio;
  const screenWidth = window.screen.width * pixelRatio;
  const screenHeight = window.screen.height * pixelRatio;
  const fullscreenScale = Math.min(screenWidth / STAGE_WIDTH, screenHeight / STAGE_HEIGHT);
  const resolution = Math.ceil(fullscreenScale);

  return Math.max(MIN_TEXT_RESOLUTION, resolution);
}

function createTextContext(width: number, height: number): CanvasRenderingContext2D {
  const resolution = textResolution();
  const canvasWidth = width * resolution;
  const canvasHeight = height * resolution;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;

  context.scale(resolution, resolution);

  return context;
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

export class QuarterCast implements Drawable {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly hotspotX: number;
  readonly hotspotY: number;
  private readonly full: BitmapCast;
  private readonly quarter: BitmapCast;
  private readonly surfaces = new Map<number, CastSurface>();

  constructor(name: string, full: DecodedBitmap, quarter: DecodedBitmap) {
    this.name = name;
    this.full = new BitmapCast(name, full);
    this.quarter = new BitmapCast(name, quarter);
    this.width = this.quarter.width;
    this.height = this.quarter.height;
    this.hotspotX = this.quarter.hotspotX;
    this.hotspotY = this.quarter.hotspotY;
  }

  get mode(): number {
    return this.quarter.mode;
  }

  set mode(mode: number) {
    this.full.mode = mode;
    this.quarter.mode = mode;
  }

  surface(): CastSurface {
    const cached = this.surfaces.get(this.mode);

    if (cached) {
      return cached;
    }

    const fullSurface = this.full.surface();
    const quarterSurface = this.quarter.surface();
    const canvas = fullSurface.canvas;
    const mask = quarterSurface.mask;
    const bbox = quarterSurface.bbox;
    const created = { canvas, mask, bbox };

    this.surfaces.set(this.mode, created);

    return created;
  }
}

export class ScaledCast implements Drawable {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly hotspotX: number;
  readonly hotspotY: number;
  private readonly source: Drawable;
  private cachedSurface: CastSurface | null = null;

  constructor(source: Drawable, width: number, height: number) {
    this.name = source.name;
    this.source = source;
    this.width = width;
    this.height = height;
    this.hotspotX = width >> 1;
    this.hotspotY = height >> 1;
  }

  get mode(): number {
    return this.source.mode;
  }

  set mode(mode: number) {
    this.source.mode = mode;
    this.cachedSurface = null;
  }

  surface(): CastSurface {
    if (this.cachedSurface) {
      return this.cachedSurface;
    }

    const canvas = this.source.surface().canvas;
    const bbox = { l: 0, t: 0, r: this.width, b: this.height };

    this.cachedSurface = { canvas, mask: null, bbox };

    return this.cachedSurface;
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
    family: "'Lucida Handwriting', 'Dancing Script', cursive",
    size: 19,
    weight: 600,
    italic: true,
  },
  {
    family: "'Lucida Calligraphy', 'Cormorant Garamond', cursive",
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

export interface ButtonColors {
  fill: string;
  border: string;
  text: string;
}

const BUTTON_BORDER_WIDTH = 2;
const BUTTON_RADIUS = 6;

export class ButtonCast implements Drawable {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly hotspotX: number;
  readonly hotspotY: number;
  mode = 0;
  private readonly font: number;
  private readonly colors: ButtonColors;
  private cachedSurface: CastSurface | null = null;

  constructor(label: string, width: number, height: number, font: number, colors: ButtonColors) {
    this.name = label;
    this.width = width;
    this.height = height;
    this.hotspotX = width >> 1;
    this.hotspotY = height >> 1;
    this.font = font;
    this.colors = colors;
  }

  surface(): CastSurface {
    if (this.cachedSurface) {
      return this.cachedSurface;
    }

    const context = createTextContext(this.width, this.height);
    const canvas = context.canvas;
    const bbox = { l: 0, t: 0, r: this.width, b: this.height };

    this.drawFrame(context);
    this.drawLabel(context);
    this.cachedSurface = { canvas, mask: null, bbox };

    return this.cachedSurface;
  }

  private drawFrame(context: CanvasRenderingContext2D): void {
    const inset = BUTTON_BORDER_WIDTH / 2;
    const width = this.width - BUTTON_BORDER_WIDTH;
    const height = this.height - BUTTON_BORDER_WIDTH;

    context.beginPath();
    context.roundRect(inset, inset, width, height, BUTTON_RADIUS);
    context.fillStyle = this.colors.fill;
    context.fill();
    context.lineWidth = BUTTON_BORDER_WIDTH;
    context.strokeStyle = this.colors.border;
    context.stroke();
  }

  private drawLabel(context: CanvasRenderingContext2D): void {
    const font = FONTS[this.font];
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    context.font = fontCss(font);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = this.colors.text;
    context.fillText(this.name, centerX, centerY);
  }
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
    this.context = createTextContext(width, height);
    this.canvas = this.context.canvas;
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

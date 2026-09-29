const KEY_INDEX = 255;

export interface DecodedBitmap {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  key: Uint8Array;
}

function readPalette(view: DataView, headerSize: number, colorCount: number): number[][] {
  const paletteOffset = 14 + headerSize;
  const palette: number[][] = [];

  for (let index = 0; index < colorCount; index++) {
    const offset = paletteOffset + index * 4;
    const blue = view.getUint8(offset);
    const green = view.getUint8(offset + 1);
    const red = view.getUint8(offset + 2);

    palette.push([red, green, blue]);
  }

  return palette;
}

export function decodeBitmap(buffer: ArrayBuffer): DecodedBitmap {
  const view = new DataView(buffer);
  const dataOffset = view.getUint32(10, true);
  const headerSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const signedHeight = view.getInt32(22, true);
  const bitCount = view.getUint16(28, true);
  const usedColors = view.getUint32(46, true);

  if (bitCount !== 8) {
    throw new Error(`Unsupported bitmap depth ${bitCount}`);
  }

  const colorCount = usedColors === 0 ? 256 : usedColors;
  const palette = readPalette(view, headerSize, colorCount);
  const height = Math.abs(signedHeight);
  const isBottomUp = signedHeight > 0;
  const stride = (width + 3) & ~3;
  const bytes = new Uint8Array(buffer);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const key = new Uint8Array(width * height);

  for (let row = 0; row < height; row++) {
    const sourceRow = isBottomUp ? height - 1 - row : row;
    const rowOffset = dataOffset + sourceRow * stride;

    for (let column = 0; column < width; column++) {
      const index = bytes[rowOffset + column];
      const color = palette[index] ?? [0, 0, 0];
      const pixel = row * width + column;
      const target = pixel * 4;

      pixels[target] = color[0];
      pixels[target + 1] = color[1];
      pixels[target + 2] = color[2];
      pixels[target + 3] = 255;
      key[pixel] = index === KEY_INDEX ? 1 : 0;
    }
  }

  return { width, height, pixels, key };
}

export function mirrorBitmap(bitmap: DecodedBitmap): DecodedBitmap {
  const { width, height } = bitmap;
  const pixels = new Uint8ClampedArray(bitmap.pixels.length);
  const key = new Uint8Array(bitmap.key.length);

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const source = row * width + column;
      const target = row * width + (width - 1 - column);

      pixels.set(bitmap.pixels.subarray(source * 4, source * 4 + 4), target * 4);
      key[target] = bitmap.key[source];
    }
  }

  return { width, height, pixels, key };
}

export function shrinkBitmap(bitmap: DecodedBitmap, factor: number): DecodedBitmap {
  const width = Math.floor(bitmap.width / factor);
  const height = Math.floor(bitmap.height / factor);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const key = new Uint8Array(width * height);

  for (let row = 0; row < height; row++) {
    const sourceRow = bitmap.height - 1 - factor * (height - 1 - row);

    for (let column = 0; column < width; column++) {
      const source = sourceRow * bitmap.width + column * factor;
      const target = row * width + column;

      pixels.set(bitmap.pixels.subarray(source * 4, source * 4 + 4), target * 4);
      key[target] = bitmap.key[source];
    }
  }

  return { width, height, pixels, key };
}

function floodBorderKey(bitmap: DecodedBitmap): Uint8Array {
  const { width, height, key } = bitmap;
  const transparent = new Uint8Array(width * height);
  const stack: number[] = [];

  const push = (column: number, row: number) => {
    const pixel = row * width + column;

    if (key[pixel] === 0 || transparent[pixel] === 1) {
      return;
    }

    transparent[pixel] = 1;
    stack.push(pixel);
  };

  for (let column = 0; column < width; column++) {
    push(column, 0);
    push(column, height - 1);
  }

  for (let row = 0; row < height; row++) {
    push(0, row);
    push(width - 1, row);
  }

  while (stack.length > 0) {
    const pixel = stack.pop() as number;
    const column = pixel % width;
    const row = (pixel - column) / width;

    if (column > 0) {
      push(column - 1, row);
    }

    if (column < width - 1) {
      push(column + 1, row);
    }

    if (row > 0) {
      push(column, row - 1);
    }

    if (row < height - 1) {
      push(column, row + 1);
    }
  }

  return transparent;
}

export function transparencyMask(bitmap: DecodedBitmap, mode: number): Uint8Array {
  if (mode === 1) {
    return floodBorderKey(bitmap);
  }

  if (mode === 2) {
    return bitmap.key;
  }

  return new Uint8Array(bitmap.width * bitmap.height);
}

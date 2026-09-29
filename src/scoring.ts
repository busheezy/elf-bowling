export const FRAME_SLOTS = 12;
export const EMPTY = -1;

export interface Frame {
  balls: [number, number];
  total: number;
  shownBalls: [boolean, boolean];
}

export interface ScoreMarks {
  first: string;
  second: string;
}

function createFrame(): Frame {
  const balls: [number, number] = [EMPTY, EMPTY];
  const shownBalls: [boolean, boolean] = [false, false];

  return { balls, total: EMPTY, shownBalls };
}

export function createFrames(): Frame[] {
  return Array.from({ length: FRAME_SLOTS }, createFrame);
}

export function firstBallMark(pins: number): string {
  if (pins === 10) {
    return "X";
  }

  if (pins === 0) {
    return "-";
  }

  return String(pins);
}

export function secondBallMark(first: number, second: number, frameIndex: number): string {
  const isSpare = first + second === 10;

  if (isSpare && frameIndex < 10) {
    return "/";
  }

  if (isSpare) {
    return String(second);
  }

  if (second === 0) {
    return "-";
  }

  return String(second);
}

function strikeBonus(frames: Frame[], index: number): number | null {
  const next = frames[index + 1];
  const nextFirst = next.balls[0];
  const nextSecond = next.balls[1];

  if (nextFirst === 10) {
    const afterNextFirst = frames[index + 2].balls[0];

    if (afterNextFirst < 0) {
      return null;
    }

    return nextFirst + afterNextFirst;
  }

  if (nextFirst < 0 || nextSecond < 0) {
    return null;
  }

  return nextFirst + nextSecond;
}

function frameValue(frames: Frame[], index: number): number | null {
  const frame = frames[index];
  const first = frame.balls[0];
  const second = frame.balls[1];

  if (first === 10) {
    const bonus = strikeBonus(frames, index);

    if (bonus === null) {
      return null;
    }

    return first + bonus;
  }

  if (first + second === 10) {
    const nextFirst = frames[index + 1].balls[0];

    if (nextFirst < 0) {
      return null;
    }

    return first + second + nextFirst;
  }

  if (first < 0 || second < 0) {
    return null;
  }

  return first + second;
}

export function updateTotals(frames: Frame[]): void {
  for (let index = 0; index < 10; index++) {
    const frame = frames[index];

    if (frame.total !== EMPTY) {
      continue;
    }

    const previousTotal = index === 0 ? 0 : frames[index - 1].total;
    const value = frameValue(frames, index);

    if (value === null) {
      continue;
    }

    frame.total = previousTotal + value;
  }
}

export function latestTotal(frames: Frame[]): number {
  const scored = frames.filter((frame) => frame.total !== EMPTY);
  const last = scored.at(-1);

  if (!last) {
    return 0;
  }

  return last.total;
}

export function isGameOver(frames: Frame[], frameIndex: number): boolean {
  if (frameIndex < 9) {
    return false;
  }

  const tenth = frames[9];
  const first = tenth.balls[0];
  const second = tenth.balls[1];

  if (first === 10) {
    return isStrikeTenthComplete(frames);
  }

  if (first + second === 10) {
    return frames[10].balls[0] >= 0;
  }

  return first >= 0 && second >= 0;
}

function isStrikeTenthComplete(frames: Frame[]): boolean {
  const eleventh = frames[10];
  const bonusFirst = eleventh.balls[0];
  const bonusSecond = eleventh.balls[1];

  if (bonusFirst === 10) {
    return frames[11].balls[0] >= 0;
  }

  return bonusFirst >= 0 && bonusSecond >= 0;
}

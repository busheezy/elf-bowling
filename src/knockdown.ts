const DIRECT_HIT = 0x400;
const BLOCKER_SHIFT = 16;
const PIN_COUNT = 10;
const MAX_PASSES = 3;

export interface KnockTables {
  mirror: number[];
  knock: number[][][];
  fly: number[][][];
  delay: number[][][];
}

export interface KnockResult {
  knocked: boolean[];
  count: number;
  mirrored: boolean;
  fly: number[] | null;
  delay: number[] | null;
}

export function accuracyFromPosition(position: number): number {
  if (position < 15) {
    return position - 9;
  }

  return 19 - position;
}

function mapPin(tables: KnockTables, pin: number, mirrored: boolean): number {
  if (!mirrored) {
    return pin;
  }

  return tables.mirror[pin];
}

function isBlocked(
  tables: KnockTables,
  mask: number,
  remaining: boolean[],
  mirrored: boolean,
): boolean {
  for (let pin = 0; pin < PIN_COUNT; pin++) {
    const bit = 1 << (BLOCKER_SHIFT + pin);
    const mapped = mapPin(tables, pin, mirrored);
    const hasBit = (mask & bit) !== 0;

    if (hasBit && remaining[mapped]) {
      return true;
    }
  }

  return false;
}

function isTriggered(
  tables: KnockTables,
  mask: number,
  standing: boolean[],
  remaining: boolean[],
  mirrored: boolean,
): boolean {
  for (let pin = 0; pin < PIN_COUNT; pin++) {
    const bit = 1 << pin;
    const mapped = mapPin(tables, pin, mirrored);
    const hasBit = (mask & bit) !== 0;
    const wasKnocked = standing[mapped] && !remaining[mapped];

    if (!hasBit || !wasKnocked) {
      continue;
    }

    const blocked = isBlocked(tables, mask, remaining, mirrored);

    if (!blocked) {
      return true;
    }
  }

  return false;
}

function shouldFall(
  tables: KnockTables,
  mask: number,
  standing: boolean[],
  remaining: boolean[],
  mirrored: boolean,
): boolean {
  if ((mask & DIRECT_HIT) !== 0) {
    return true;
  }

  return isTriggered(tables, mask, standing, remaining, mirrored);
}

function runPass(
  tables: KnockTables,
  row: number[],
  standing: boolean[],
  remaining: boolean[],
  mirrored: boolean,
): number {
  const fallenPins: number[] = [];

  for (let pin = PIN_COUNT - 1; pin >= 0; pin--) {
    const mapped = mapPin(tables, pin, mirrored);

    if (!remaining[mapped]) {
      continue;
    }

    const mask = row[pin];
    const falls = shouldFall(tables, mask, standing, remaining, mirrored);

    if (falls) {
      remaining[mapped] = false;
      fallenPins.push(mapped);
    }
  }

  return fallenPins.length;
}

export function resolveKnockdown(
  tables: KnockTables,
  position: number,
  standing: boolean[],
  variant: number,
): KnockResult {
  const accuracy = accuracyFromPosition(position);
  const mirrored = position >= 15;
  const remaining = [...standing];

  if (accuracy < 0) {
    const knocked = Array.from({ length: PIN_COUNT }, () => false);

    return { knocked, count: 0, mirrored, fly: null, delay: null };
  }

  const row = tables.knock[accuracy][variant];
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const fallen = runPass(tables, row, standing, remaining, mirrored);

    if (fallen === 0) {
      break;
    }
  }

  const knocked = standing.map((isStanding, pin) => isStanding && !remaining[pin]);
  const count = knocked.filter(Boolean).length;
  const fly = tables.fly[accuracy][variant];
  const delay = tables.delay[accuracy][variant];

  return { knocked, count, mirrored, fly, delay };
}

const BEST_SCORE_KEY = "elf-bowling-best-score";

export const session = {
  finalScore: 0,
};

export function readBestScore(): number {
  try {
    const stored = localStorage.getItem(BEST_SCORE_KEY);
    const score = Number(stored);

    return Number.isFinite(score) ? score : 0;
  } catch {
    return 0;
  }
}

export function recordBestScore(score: number): void {
  const best = readBestScore();

  if (score <= best) {
    return;
  }

  const value = String(score);

  try {
    localStorage.setItem(BEST_SCORE_KEY, value);
  } catch {
    return;
  }
}

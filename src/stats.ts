import { QuizMode } from './quiz';

export interface QuizAttempt {
  id: string;
  algoId: string;
  algoTitle: string;
  algoNumber: string;
  mode: QuizMode;
  score: number;
  totalItems: number;
  correctItems: number;
  timestamp: number;
  missedParts: string[];
}

export interface AlgoProgress {
  algoId: string;
  algoTitle: string;
  algoNumber: string;
  attempts: number;
  bestScore: number;
  lastScore: number;
  avgScore: number;
  trend: 'improving' | 'declining' | 'stable';
  lastPracticed: number;
  recentScores: number[];
}

export interface Suggestion {
  algoId: string;
  algoTitle: string;
  algoNumber: string;
  reason: string;
  priority: number;
}

const STORAGE_KEY = 'pracudo_stats';

function loadAttempts(): QuizAttempt[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveAttempts(attempts: QuizAttempt[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
}

export function recordAttempt(data: Omit<QuizAttempt, 'id' | 'timestamp'>): void {
  const attempts = loadAttempts();
  attempts.push({
    ...data,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  saveAttempts(attempts);
}

export function getAttempts(algoId?: string): QuizAttempt[] {
  const all = loadAttempts();
  return algoId ? all.filter((a) => a.algoId === algoId) : all;
}

export function getAlgoProgress(algoId: string): AlgoProgress | null {
  const attempts = getAttempts(algoId);
  if (attempts.length === 0) return null;

  const scores = attempts.map((a) => a.score);
  const recent = scores.slice(-5);
  const bestScore = Math.max(...scores);
  const lastScore = scores[scores.length - 1];
  const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  let trend: AlgoProgress['trend'] = 'stable';
  if (scores.length >= 3) {
    const last3 = scores.slice(-3);
    const last3Avg = last3.reduce((s, v) => s + v, 0) / last3.length;
    const older = scores.slice(0, -3);
    if (older.length > 0) {
      const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
      if (last3Avg > olderAvg + 10) trend = 'improving';
      else if (last3Avg < olderAvg - 10) trend = 'declining';
    } else {
      if (last3[2] > last3[0] + 10) trend = 'improving';
      else if (last3[2] < last3[0] - 10) trend = 'declining';
    }
  }

  return {
    algoId,
    algoTitle: attempts[attempts.length - 1].algoTitle,
    algoNumber: attempts[attempts.length - 1].algoNumber,
    attempts: attempts.length,
    bestScore,
    lastScore,
    avgScore,
    trend,
    lastPracticed: attempts[attempts.length - 1].timestamp,
    recentScores: recent,
  };
}

export function getAllAlgoProgress(): AlgoProgress[] {
  const attempts = loadAttempts();
  const algoIds = [...new Set(attempts.map((a) => a.algoId))];
  return algoIds
    .map((id) => getAlgoProgress(id))
    .filter((p): p is AlgoProgress => p !== null)
    .sort((a, b) => b.lastPracticed - a.lastPracticed);
}

export function getOverallStats(): {
  totalAttempts: number;
  avgScore: number;
  practicedCount: number;
} {
  const attempts = loadAttempts();
  if (attempts.length === 0)
    return { totalAttempts: 0, avgScore: 0, practicedCount: 0 };
  return {
    totalAttempts: attempts.length,
    avgScore: Math.round(
      attempts.reduce((s, a) => s + a.score, 0) / attempts.length
    ),
    practicedCount: new Set(attempts.map((a) => a.algoId)).size,
  };
}

export function getSuggestions(
  libraryAlgos: { id: string; title: string; number: string }[]
): Suggestion[] {
  const byAlgo = new Map<string, Suggestion>();
  const allProgress = getAllAlgoProgress();
  const practicedIds = new Set(allProgress.map((p) => p.algoId));

  function keep(s: Suggestion) {
    const existing = byAlgo.get(s.algoId);
    if (!existing || s.priority > existing.priority) {
      byAlgo.set(s.algoId, s);
    }
  }

  for (const algo of libraryAlgos) {
    if (!practicedIds.has(algo.id)) {
      keep({
        algoId: algo.id,
        algoTitle: algo.title,
        algoNumber: algo.number,
        reason: 'Még nem gyakoroltad',
        priority: 50,
      });
    }
  }

  for (const prog of allProgress) {
    if (prog.lastScore < 70) {
      keep({
        algoId: prog.algoId,
        algoTitle: prog.algoTitle,
        algoNumber: prog.algoNumber,
        reason: `Utolsó eredmény: ${prog.lastScore}%`,
        priority: 100 - prog.lastScore,
      });
    } else if (prog.trend === 'declining') {
      keep({
        algoId: prog.algoId,
        algoTitle: prog.algoTitle,
        algoNumber: prog.algoNumber,
        reason: `Csökkenő trend (átlag: ${prog.avgScore}%)`,
        priority: 40,
      });
    }

    const daysSince = (Date.now() - prog.lastPracticed) / 86400000;
    if (daysSince > 3 && prog.lastScore < 90) {
      keep({
        algoId: prog.algoId,
        algoTitle: prog.algoTitle,
        algoNumber: prog.algoNumber,
        reason: `${Math.floor(daysSince)} napja nem gyakoroltad`,
        priority: Math.min(80, 30 + daysSince * 5),
      });
    }
  }

  return [...byAlgo.values()].sort((a, b) => b.priority - a.priority);
}

export function getFrequentMistakes(
  algoId?: string
): { text: string; count: number }[] {
  const attempts = getAttempts(algoId);
  const counts = new Map<string, number>();

  for (const attempt of attempts) {
    for (const part of attempt.missedParts) {
      const trimmed = part.trim();
      if (trimmed) counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function resetStats(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'most';
  if (minutes < 60) return `${minutes} perce`;
  if (hours < 24) return `${hours} órája`;
  if (days === 1) return 'tegnap';
  if (days < 30) return `${days} napja`;
  return `${Math.floor(days / 30)} hónapja`;
}

import { Algorithm } from './parser';

const STORAGE_KEY = 'pracudo_algorithms';

export function loadAlgorithms(): Algorithm[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

export function saveAlgorithm(algo: Algorithm): void {
  const all = loadAlgorithms();
  const idx = all.findIndex((a) => a.id === algo.id);
  if (idx >= 0) {
    all[idx] = algo;
  } else {
    all.push(algo);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteAlgorithm(id: string): void {
  const all = loadAlgorithms().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getAlgorithm(id: string): Algorithm | undefined {
  return loadAlgorithms().find((a) => a.id === id);
}

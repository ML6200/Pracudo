export interface AliasEntry {
  canonical: string;
  aliases: string[];
}

const DEFAULT_ALIASES: AliasEntry[] = [
  { canonical: '←', aliases: ['<-', ':='] },
  { canonical: '∧', aliases: ['^', '&&', ' AND '] },
  { canonical: '∨', aliases: ['||', ' OR '] },
  { canonical: '¬', aliases: ['!', 'NOT '] },
  { canonical: '≥', aliases: ['>='] },
  { canonical: '≤', aliases: ['<='] },
  { canonical: '≠', aliases: ['!=', '<>'] },
  { canonical: '≡', aliases: ['===', '=='] },
  { canonical: '⌊', aliases: ['floor('] },
  { canonical: '⌋', aliases: [')floor'] },
  { canonical: '⌈', aliases: ['ceil('] },
  { canonical: '⌉', aliases: [')ceil'] },
  { canonical: '…', aliases: ['...'] },
  { canonical: '∞', aliases: ['INF', 'Infinity'] },
];

const STORAGE_KEY = 'pracudo_aliases';

let activeAliases: AliasEntry[] = [];
let replacementPairs: [string, string][] = [];
let prefixAliases: Set<string> = new Set();

function rebuildPairs() {
  replacementPairs = [];
  for (const entry of activeAliases) {
    for (const alias of entry.aliases) {
      replacementPairs.push([alias, entry.canonical]);
    }
  }
  replacementPairs.sort((a, b) => b[0].length - a[0].length);

  prefixAliases = new Set();
  const allAliasStrings = replacementPairs.map(([a]) => a);
  for (const alias of allAliasStrings) {
    for (const longer of allAliasStrings) {
      if (longer.length > alias.length && longer.startsWith(alias)) {
        prefixAliases.add(alias);
        break;
      }
    }
  }
}

export function loadAliases(): AliasEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    activeAliases = JSON.parse(raw);
  } else {
    activeAliases = structuredClone(DEFAULT_ALIASES);
  }
  rebuildPairs();
  return activeAliases;
}

export function saveAliases(entries: AliasEntry[]) {
  activeAliases = entries;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  rebuildPairs();
}

export function resetAliases() {
  localStorage.removeItem(STORAGE_KEY);
  activeAliases = structuredClone(DEFAULT_ALIASES);
  rebuildPairs();
}

export function getAliases(): AliasEntry[] {
  return activeAliases;
}

export function getDefaultAliases(): AliasEntry[] {
  return structuredClone(DEFAULT_ALIASES);
}

export function applyAliases(text: string): string {
  let result = text;
  for (const [alias, canonical] of replacementPairs) {
    result = result.split(alias).join(canonical);
  }
  return result;
}

export function reverseAliases(text: string): string {
  let result = text;
  for (const entry of activeAliases) {
    if (entry.aliases.length > 0) {
      result = result.split(entry.canonical).join(entry.aliases[0]);
    }
  }
  return result;
}

export function normalizeForComparison(text: string): string {
  let result = applyAliases(text);
  result = result.replace(/[−–—]/g, '-');
  result = result.replace(/\s+/g, '');
  return result;
}

export function setupLiveAliasing(textarea: HTMLTextAreaElement): void {
  textarea.addEventListener('input', () => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const original = textarea.value;

    const beforeCursor = original.substring(0, start);
    for (const alias of prefixAliases) {
      if (beforeCursor.endsWith(alias)) return;
    }

    const replaced = applyAliases(original);

    if (replaced !== original) {
      const lenDiff = replaced.length - original.length;
      textarea.value = replaced;
      textarea.selectionStart = start + lenDiff;
      textarea.selectionEnd = end + lenDiff;
    }
  });
}

// Initialize on import
loadAliases();

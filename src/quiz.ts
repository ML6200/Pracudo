import { Algorithm, PseudoLine } from './parser';
import { normalizeForComparison } from './aliases';

export type QuizMode = 'blanks' | 'reproduce';

export interface BlankSlot {
  lineIndex: number;
  tokenStart: number;
  tokenEnd: number;
  answer: string;
  userAnswer: string;
}

export interface LineDiff {
  lineNumber: number;
  expected: string;
  actual: string;
  status: 'correct' | 'wrong' | 'missing' | 'extra';
  segments?: DiffSegment[];
}

export interface DiffSegment {
  text: string;
  status: 'correct' | 'wrong' | 'missing';
}

export interface QuizResult {
  mode: QuizMode;
  totalItems: number;
  correctItems: number;
  score: number;
  details: LineDiff[] | BlankSlot[];
}

export function generateBlanks(algo: Algorithm, difficulty: number = 0.4): BlankSlot[] {
  const blanks: BlankSlot[] = [];
  const candidateLines = algo.lines.filter((line) => {
    const raw = line.raw.toLowerCase();
    return !(
      raw.startsWith('függvény ') ||
      raw === 'függvény vége' ||
      raw === 'eljárás vége' ||
      raw === 'ciklus vége' ||
      raw === 'elágazás vége'
    );
  });

  const numBlanks = Math.max(1, Math.floor(candidateLines.length * difficulty));
  const shuffled = [...candidateLines].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, numBlanks);

  for (const line of selected) {
    const lineIndex = algo.lines.indexOf(line);
    const blankableTokens = findBlankableSpan(line);

    if (blankableTokens) {
      blanks.push({
        lineIndex,
        tokenStart: blankableTokens.start,
        tokenEnd: blankableTokens.end,
        answer: blankableTokens.text,
        userAnswer: '',
      });
    }
  }

  blanks.sort((a, b) => a.lineIndex - b.lineIndex);
  return blanks;
}

function findBlankableSpan(line: PseudoLine): { start: number; end: number; text: string } | null {
  const tokens = line.tokens;

  const arrowIdx = tokens.findIndex((t) => t.value === '←');
  if (arrowIdx >= 0 && arrowIdx < tokens.length - 1) {
    const start = arrowIdx + 1;
    const end = tokens.length;
    const text = tokens
      .slice(start, end)
      .map((t) => t.value)
      .join('');
    return { start, end, text };
  }

  const conditionKeywords = ['amíg', 'akkor'];
  for (let i = 0; i < tokens.length; i++) {
    if (conditionKeywords.includes(tokens[i].value.toLowerCase())) {
      const start = i + 1;
      const end = tokens.length;
      if (start < end) {
        const text = tokens
          .slice(start, end)
          .map((t) => t.value)
          .join('');
        return { start, end, text };
      }
    }
  }

  const varTokens = tokens.filter((t) => t.type === 'variable' || t.type === 'number');
  if (varTokens.length > 0) {
    const target = varTokens[Math.floor(Math.random() * varTokens.length)];
    const idx = tokens.indexOf(target);
    return { start: idx, end: idx + 1, text: target.value };
  }

  return null;
}

export function checkBlanks(blanks: BlankSlot[]): QuizResult {
  let correct = 0;
  for (const blank of blanks) {
    const expected = normalizeForComparison(blank.answer);
    const actual = normalizeForComparison(blank.userAnswer);
    if (expected === actual) correct++;
  }

  return {
    mode: 'blanks',
    totalItems: blanks.length,
    correctItems: correct,
    score: blanks.length > 0 ? Math.round((correct / blanks.length) * 100) : 0,
    details: blanks,
  };
}

export function checkReproduction(algo: Algorithm, userText: string): QuizResult {
  const expectedLines = algo.lines.map((l) => l.raw);
  const actualLines = userText
    .split('\n')
    .map((l) => l.replace(/^\s*\d+:\s*/, '').trim())
    .filter((l) => {
      const lower = l.toLowerCase();
      return l.length > 0 &&
        !lower.startsWith('bemenet') &&
        !lower.startsWith('kimenet') &&
        !lower.match(/^\d+\.\d+/);
    });

  const diffs: LineDiff[] = [];
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  let correct = 0;

  for (let i = 0; i < maxLen; i++) {
    const expected = expectedLines[i] ?? '';
    const actual = actualLines[i] ?? '';

    if (i >= expectedLines.length) {
      diffs.push({
        lineNumber: i + 1,
        expected: '',
        actual,
        status: 'extra',
      });
      continue;
    }

    if (i >= actualLines.length) {
      diffs.push({
        lineNumber: i + 1,
        expected,
        actual: '',
        status: 'missing',
      });
      continue;
    }

    const normExpected = normalizeForComparison(expected);
    const normActual = normalizeForComparison(actual);

    if (normExpected === normActual) {
      correct++;
      diffs.push({
        lineNumber: i + 1,
        expected,
        actual,
        status: 'correct',
        segments: [{ text: actual, status: 'correct' }],
      });
    } else {
      diffs.push({
        lineNumber: i + 1,
        expected,
        actual,
        status: 'wrong',
        segments: computeSegments(expected, actual),
      });
    }
  }

  return {
    mode: 'reproduce',
    totalItems: expectedLines.length,
    correctItems: correct,
    score: expectedLines.length > 0 ? Math.round((correct / expectedLines.length) * 100) : 0,
    details: diffs,
  };
}

function computeSegments(expected: string, actual: string): DiffSegment[] {
  const expWords = expected.trim().split(/\s+/);
  const actWords = actual.trim().split(/\s+/);
  const segments: DiffSegment[] = [];

  const maxLen = Math.max(expWords.length, actWords.length);
  for (let i = 0; i < maxLen; i++) {
    const ew = normalizeForComparison(expWords[i] ?? '');
    const aw = actWords[i] ?? '';

    if (i >= actWords.length) {
      segments.push({ text: expWords[i], status: 'missing' });
    } else if (ew === normalizeForComparison(aw)) {
      segments.push({ text: aw, status: 'correct' });
    } else {
      segments.push({ text: aw, status: 'wrong' });
    }
  }

  for (let i = expWords.length; i < actWords.length; i++) {
    segments.push({ text: actWords[i], status: 'wrong' });
  }

  return segments;
}

export function renderBlanksQuiz(algo: Algorithm, blanks: BlankSlot[]): string {
  let html = '<div class="quiz-blanks">';

  html += `<div class="algo-header">`;
  html += `<span class="algo-number">${algo.number}</span> `;
  html += `<span class="algo-label">Algoritmus</span> `;
  html += `<span class="algo-title">${algo.title}</span>`;
  html += `</div>`;

  for (let li = 0; li < algo.lines.length; li++) {
    const line = algo.lines[li];
    const blank = blanks.find((b) => b.lineIndex === li);
    const indent = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(line.indent);

    html += `<div class="algo-line">`;
    html += `<span class="line-number">${line.lineNumber}:</span>`;
    html += `<span class="line-content">${indent}`;

    if (blank) {
      for (let ti = 0; ti < line.tokens.length; ti++) {
        if (ti === blank.tokenStart) {
          const size = Math.max(10, blank.answer.length + 2);
          html += `<input type="text" class="blank-input" data-blank-index="${blanks.indexOf(blank)}" size="${size}" placeholder="???" autocomplete="off" spellcheck="false">`;
          ti = blank.tokenEnd - 1;
        } else {
          const t = line.tokens[ti];
          const escaped = t.value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          if (t.type === 'keyword') {
            html += `<span class="token-keyword">${escaped}</span>`;
          } else if (t.type === 'variable') {
            html += `<span class="token-variable">${escaped}</span>`;
          } else if (t.type === 'operator') {
            html += `<span class="token-operator">${escaped}</span>`;
          } else {
            html += escaped;
          }
        }
      }
    } else {
      for (const t of line.tokens) {
        const escaped = t.value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (t.type === 'keyword') {
          html += `<span class="token-keyword">${escaped}</span>`;
        } else if (t.type === 'variable') {
          html += `<span class="token-variable">${escaped}</span>`;
        } else if (t.type === 'operator') {
          html += `<span class="token-operator">${escaped}</span>`;
        } else {
          html += escaped;
        }
      }
    }

    html += `</span></div>`;
  }

  html += '</div>';
  return html;
}

export function renderReproductionResult(diffs: LineDiff[]): string {
  let html = '<div class="quiz-result">';

  for (const diff of diffs) {
    const statusClass = `diff-${diff.status}`;
    html += `<div class="diff-line ${statusClass}">`;
    html += `<span class="line-number">${diff.lineNumber}:</span>`;

    if (diff.status === 'missing') {
      html += `<span class="diff-expected">${escapeHtml(diff.expected)}</span>`;
      html += `<span class="diff-label">hiányzik</span>`;
    } else if (diff.status === 'extra') {
      html += `<span class="diff-actual">${escapeHtml(diff.actual)}</span>`;
      html += `<span class="diff-label">felesleges</span>`;
    } else if (diff.segments) {
      html += `<span class="diff-segments">`;
      for (const seg of diff.segments) {
        html += `<span class="seg-${seg.status}">${escapeHtml(seg.text)} </span>`;
      }
      html += `</span>`;
      if (diff.status === 'wrong') {
        html += `<span class="diff-hint">→ ${escapeHtml(diff.expected)}</span>`;
      }
    }

    html += `</div>`;
  }

  html += '</div>';
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface Token {
  type: 'keyword' | 'variable' | 'operator' | 'number' | 'punctuation' | 'text' | 'type' | 'comment';
  value: string;
}

export interface PseudoLine {
  lineNumber: number;
  indent: number;
  tokens: Token[];
  raw: string;
}

export interface Algorithm {
  id: string;
  number: string;
  title: string;
  inputs: string;
  outputs: string;
  lines: PseudoLine[];
  rawText: string;
}

const KEYWORDS = new Set([
  'függvény', 'függvény vége', 'eljárás', 'eljárás vége',
  'ciklus', 'amíg', 'ciklus vége',
  'ha', 'akkor', 'különben', 'elágazás vége',
  'vissza', 'címszerint',
  'Bemenet', 'Kimenet',
  'igaz', 'hamis',
  'és', 'vagy', 'nem',
  'tól', 'ig', 'lépésköz',
  'minden',
]);

const COMPOUND_KEYWORDS = [
  'függvény vége',
  'eljárás vége',
  'ciklus amíg',
  'ciklus vége',
  'elágazás vége',
];

const TYPE_KEYWORDS = new Set([
  'egész', 'valós', 'logikai', 'karakter', 'szöveg', 'tömb',
]);

const OPERATORS = new Set([
  '←', '∧', '∨', '¬', '≥', '≤', '≠', '≡',
  '+', '-', '*', '/', '%', '=', '<', '>',
  '(', ')', '[', ']', ',', ':', '.', ';',
]);

function measureIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  return Math.floor(match[1].length / 4);
}

export function tokenizeLine(raw: string): Token[] {
  const tokens: Token[] = [];
  let remaining = raw.trim();

  while (remaining.length > 0) {
    remaining = remaining.replace(/^\s+/, (ws) => {
      if (tokens.length > 0) tokens.push({ type: 'text', value: ws });
      return '';
    });

    if (remaining.length === 0) break;

    let matched = false;

    for (const compound of COMPOUND_KEYWORDS) {
      if (remaining.toLowerCase().startsWith(compound.toLowerCase())) {
        tokens.push({ type: 'keyword', value: remaining.slice(0, compound.length) });
        remaining = remaining.slice(compound.length);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const wordMatch = remaining.match(/^[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (KEYWORDS.has(word.toLowerCase()) || KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (TYPE_KEYWORDS.has(word.toLowerCase()) || TYPE_KEYWORDS.has(word)) {
        tokens.push({ type: 'type', value: word });
      } else {
        tokens.push({ type: 'variable', value: word });
      }
      remaining = remaining.slice(word.length);
      continue;
    }

    const numMatch = remaining.match(/^\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[0] });
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    if (OPERATORS.has(remaining[0])) {
      tokens.push({ type: 'operator', value: remaining[0] });
      remaining = remaining.slice(1);
      continue;
    }

    tokens.push({ type: 'punctuation', value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}

export function parseAlgorithm(text: string): Algorithm {
  const lines = text.split('\n');
  const algo: Algorithm = {
    id: crypto.randomUUID(),
    number: '',
    title: '',
    inputs: '',
    outputs: '',
    lines: [],
    rawText: text,
  };

  let lineCounter = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const titleMatch = trimmed.match(/^(\d+\.\d+\.?)\s*(?:Algoritmus\s+)?(.*)$/i);
    if (titleMatch && !algo.title) {
      algo.number = titleMatch[1];
      algo.title = titleMatch[2];
      continue;
    }

    const inputMatch = trimmed.match(/^Bemenet:\s*(.*)$/i);
    if (inputMatch) {
      algo.inputs = inputMatch[1];
      continue;
    }

    const outputMatch = trimmed.match(/^Kimenet:\s*(.*)$/i);
    if (outputMatch) {
      algo.outputs = outputMatch[1];
      continue;
    }

    const lineNumMatch = trimmed.match(/^(\d+):\s*(.*)$/);
    let content: string;
    let lineNum: number;

    if (lineNumMatch) {
      lineNum = parseInt(lineNumMatch[1]);
      content = lineNumMatch[2];
    } else {
      lineCounter++;
      lineNum = lineCounter;
      content = trimmed;
    }

    const indent = lineNumMatch
      ? measureIndent(line.replace(/^\s*\d+:\s*/, ''))
      : measureIndent(line);

    const realIndent = lineNumMatch
      ? Math.max(0, Math.floor((line.indexOf(content) - line.indexOf(lineNumMatch[0]) - lineNumMatch[1].length - 2) / 4))
      : indent;

    algo.lines.push({
      lineNumber: lineNum,
      indent: realIndent,
      tokens: tokenizeLine(content),
      raw: content,
    });
  }

  if (!algo.title && algo.lines.length > 0) {
    algo.title = 'Névtelen algoritmus';
  }

  return algo;
}

export function algorithmToText(algo: Algorithm): string {
  const parts: string[] = [];

  if (algo.number || algo.title) {
    parts.push(`${algo.number} Algoritmus ${algo.title}`);
  }
  if (algo.inputs) parts.push(`Bemenet: ${algo.inputs}`);
  if (algo.outputs) parts.push(`Kimenet: ${algo.outputs}`);

  for (const line of algo.lines) {
    const indentation = '    '.repeat(line.indent);
    parts.push(`${line.lineNumber}: ${indentation}${line.raw}`);
  }

  return parts.join('\n');
}

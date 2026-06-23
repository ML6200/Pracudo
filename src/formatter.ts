import { applyAliases } from './aliases';

const INDENT_OPENERS = [
  /^függvény\b(?!.*\bvége\b)/i,
  /^eljárás\b(?!.*\bvége\b)/i,
  /^ciklus\b(?!.*\bvége\b)/i,
  /^ha\b.*\bakkor\b/i,
  /^különben$/i,
];

const INDENT_CLOSERS = [
  /^függvény vége$/i,
  /^eljárás vége$/i,
  /^ciklus vége$/i,
  /^elágazás vége$/i,
  /^különben$/i,
];

export function formatPseudoCode(text: string): string {
  text = applyAliases(text);

  const lines = text.split('\n');
  const result: string[] = [];
  let indent = 0;
  let headerDone = false;

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Preserve algorithm title, Bemenet, Kimenet as-is
    if (!headerDone) {
      if (/^\d+\.\d+/.test(line) || /^Algoritmus\b/i.test(line)) {
        result.push(line);
        continue;
      }
      if (/^Bemenet:/i.test(line) || /^Kimenet:/i.test(line)) {
        result.push(line);
        continue;
      }
    }

    // Strip existing line number
    const numMatch = line.match(/^(\d+):\s*(.*)/);
    if (numMatch) {
      line = numMatch[2].trim();
    }

    if (!line) continue;
    headerDone = true;

    // Normalize spacing around operators
    line = normalizeSpacing(line);

    // Check if this line closes a block (dedent before printing)
    const isCloser = INDENT_CLOSERS.some((re) => re.test(line));
    if (isCloser) {
      indent = Math.max(0, indent - 1);
    }

    const lineNum = result.filter((l) => /^\d+:/.test(l)).length + 1;
    const indentation = '    '.repeat(indent);
    result.push(`${lineNum}: ${indentation}${line}`);

    // Check if this line opens a block (indent after printing)
    const isOpener = INDENT_OPENERS.some((re) => re.test(line));
    if (isOpener) {
      indent++;
    }
  }

  return result.join('\n');
}

function normalizeSpacing(line: string): string {
  // Normalize spaces around ←
  line = line.replace(/\s*←\s*/g, ' ← ');

  // Normalize spaces around ∧ ∨
  line = line.replace(/\s*∧\s*/g, ' ∧ ');
  line = line.replace(/\s*∨\s*/g, ' ∨ ');

  // Normalize spaces around comparison operators (but not inside ←)
  line = line.replace(/\s*([<>])\s*/g, ' $1 ');
  line = line.replace(/\s*(≤|≥|≠)\s*/g, ' $1 ');

  // Normalize spaces around arithmetic operators
  line = line.replace(/\s*([+])\s*/g, ' $1 ');
  line = line.replace(/\s*([−\-])\s+/g, ' $1 ');

  // Don't add space before ( or after )
  line = line.replace(/\(\s+/g, '(');
  line = line.replace(/\s+\)/g, ')');

  // Don't add space before [ or after ]
  line = line.replace(/\[\s+/g, '[');
  line = line.replace(/\s+\]/g, ']');

  // Don't add space before , but add after
  line = line.replace(/\s*,\s*/g, ', ');

  // Don't add space before :
  line = line.replace(/\s*:\s*/g, ' : ');

  // Collapse multiple spaces
  line = line.replace(/\s{2,}/g, ' ');

  return line.trim();
}

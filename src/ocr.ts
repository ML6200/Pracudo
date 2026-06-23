import Tesseract from 'tesseract.js';
import { formatPseudoCode } from './formatter';

export async function recognizeImage(
  imageSource: File | string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await Tesseract.recognize(imageSource, 'hun+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  return formatPseudoCode(postProcessOCR(result.data.text));
}

const KEYWORD_LINES = /^(ciklus|ha |különben|elágazás|függvény|eljárás|vissza|Bemenet|Kimenet)/i;

const HUN_WORD = '[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*';

export function postProcessOCR(text: string): string {
  let result = text;

  // === Phase 1: Unambiguous character-level arrow fixes ===
  // €— €– €- are always ← (no valid pseudo code meaning)
  result = result.replace(/€[—–\-]/g, '←');
  // <— <– are always ←
  result = result.replace(/<[—–]/g, '←');
  // <-  is always ← (also covered by aliases, but fix early)
  result = result.replace(/<-/g, '←');
  // —> → (rarely used but handle it)
  result = result.replace(/—>/g, '→');

  // === Phase 2: Logical operator fixes ===
  // Standalone A between expressions → ∧
  // Patterns: ") A ¬", ") A P(", "jobb) A", etc.
  result = result.replace(/\)\s*A\s+/g, ') ∧ ');
  result = result.replace(/\s+A\s+(?=[¬!—\-]?[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű(])/g, ' ∧ ');

  // —P( or –P( or -P( before parenthesis → ¬P( (negation)
  result = result.replace(/[—–\-]([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű])\s*\(/g, '¬$1(');

  // === Phase 3: Keyword / accent recovery ===
  result = result.replace(/\bfliggv[eé]ny\b/gi, 'függvény');
  result = result.replace(/\bfiiggv[eé]ny\b/gi, 'függvény');
  result = result.replace(/\bfüggv[eé]ny\b/gi, 'függvény');
  result = result.replace(/\bfuggv[eé]ny\b/gi, 'függvény');
  result = result.replace(/\bcimszerint\b/gi, 'címszerint');
  result = result.replace(/\bciklus amig\b/gi, 'ciklus amíg');
  result = result.replace(/\belagazas\b/gi, 'elágazás');
  result = result.replace(/\belágazas\b/gi, 'elágazás');
  result = result.replace(/\bkulonben\b/gi, 'különben');
  result = result.replace(/\bkülonben\b/gi, 'különben');
  result = result.replace(/\bseged\b/gi, 'segéd');
  result = result.replace(/\bakkor\b/gi, 'akkor');
  result = result.replace(/\bvissza\b/gi, 'vissza');
  result = result.replace(/\begész\b/gi, 'egész');
  result = result.replace(/\begesz\b/gi, 'egész');
  result = result.replace(/\blogikai\b/gi, 'logikai');
  result = result.replace(/\btomb\b/gi, 'tömb');
  result = result.replace(/\bSZETVALOGAT\b/g, 'SZÉTVÁLOGAT');

  // === Phase 4: Line-level assignment arrow recovery ===
  // On non-keyword lines, the first < or + between an identifier/subscript
  // and an expression is almost certainly ← (OCR misread of the arrow).
  result = result
    .split('\n')
    .map((line) => fixAssignmentArrow(line))
    .join('\n');

  // === Phase 5: Em-dash as minus sign on the RHS of assignment ===
  // After ←, convert standalone — or – to − (minus)
  result = result.replace(/←(.*)/g, (_, rhs) => {
    return '←' + rhs.replace(/\s*[—–]\s*/g, ' − ');
  });

  // Closing bracket misreads: l) → ]) when preceded by a word char
  // The ) was originally ] and the real ) follows, so restore both
  result = result.replace(/([a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ0-9])l\)/g, '$1])');

  // Fix unbalanced brackets: count [ vs ] per line, add missing ]
  result = result
    .split('\n')
    .map((line) => {
      const opens = (line.match(/\[/g) || []).length;
      const closes = (line.match(/\]/g) || []).length;
      if (opens > closes) {
        const parens = line.lastIndexOf(')');
        if (parens > line.lastIndexOf('[')) {
          return line.slice(0, parens) + ']' + line.slice(parens);
        }
      }
      return line;
    })
    .join('\n');

  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

function fixAssignmentArrow(line: string): string {
  // Match optional line number prefix
  const prefixMatch = line.match(/^(\s*\d+:\s*)(.*)/);
  if (!prefixMatch) return line;

  const prefix = prefixMatch[1];
  const content = prefixMatch[2];

  // Already has ← → skip
  if (content.includes('←')) return line;

  // Skip keyword lines (conditions, loops, returns, etc.)
  if (KEYWORD_LINES.test(content.trim())) return line;

  // Pattern: identifier or identifier[expr] followed by < or + then expression
  // This is the main assignment operator on the line
  const assignPattern = new RegExp(
    `^(\\s*${HUN_WORD}(?:\\[[^\\]]*\\])?)\\s*([<+])\\s*(.+)$`
  );
  const m = content.match(assignPattern);
  if (m) {
    return prefix + m[1] + ' ← ' + m[3];
  }

  return line;
}

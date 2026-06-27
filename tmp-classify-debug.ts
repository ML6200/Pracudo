import { parseAlgorithm } from './src/parser.ts';
import { classifyLine } from './src/interpreter.ts';
import { Algorithm } from './src/parser.ts';

const text = `Bemenet: a - egész
Kimenet: b - egész
b ← K(a) + L(a)
függvény K(a : egész)
    vissza a + 1
függvény vége
függvény L(a : egész)
    vissza a + 2
függvény vége
`;
const lines = text.split('\n').filter((l) => l.trim());
for (const [i, line] of lines.entries()) {
  console.log(i, JSON.stringify(line), classifyLine(line.trim()));
}

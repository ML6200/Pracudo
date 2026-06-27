import { parseAlgorithm } from './src/parser.ts';
import { Interpreter } from './src/interpreter.ts';

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

const algo = parseAlgorithm(text);
const interp = new Interpreter(algo);
interp.setInputs({ a: 5 });
console.log('init pc', interp.currentLineIndex, 'endPc', (interp as any).endPc, 'funcParams', interp.funcParams);
for (let i = 0; i < 20; i++) {
  const step = interp.step();
  console.log('STEP', i, 'pc', interp.currentLineIndex, 'finished', interp.finished, 'error', interp.error, 'return', interp.returnValue, 'vars', interp.getVariables());
  if (step) {
    console.log('  step lineIdx', step.lineIndex, 'lineNum', step.lineNumber, 'desc', JSON.stringify(step.description));
  }
  if (interp.finished || interp.error) break;
}
console.log('FINAL', interp.finished, interp.error, interp.returnValue, interp.getVariables());

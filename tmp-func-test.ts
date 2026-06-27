import { parseAlgorithm } from './src/parser.ts';
import { Interpreter } from './src/interpreter.ts';

const text = `Bemenet: a - egész
Kimenet: b - egész
b ← K(a)
függvény K(a : egész)
    vissza a + 1
függvény vége
`;

const algo = parseAlgorithm(text);
const interp = new Interpreter(algo);
interp.setInputs({ a: 5 });
console.log('start pc', interp.currentLineIndex, 'start endPc', (interp as any).endPc);
let stepCount = 0;
while (!interp.finished && !interp.error && stepCount < 50) {
  const step = interp.step();
  console.log('step', step?.lineNumber, step?.description, interp.getVariables());
  stepCount++;
}
console.log('finished', interp.finished, 'error', interp.error, 'return', interp.returnValue, 'vars', interp.getVariables());

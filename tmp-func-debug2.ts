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
const interp = new Interpreter(algo) as any;
interp.setInputs({ a: 5 });

const origEnter = interp.enterFunction.bind(interp);
interp.enterFunction = function (fn: any, args: any, assignTarget?: any, returnToCurrentLine = false) {
  console.log('ENTER', fn.name, 'pc', this.pc, 'returnToCurrentLine', returnToCurrentLine, 'assignTarget', assignTarget);
  return origEnter(fn, args, assignTarget, returnToCurrentLine);
};

const origEvalCall = interp.evalCall.bind(interp);
interp.evalCall = function (name: string, args: any[]) {
  console.log('EVALCALL START', name, 'pc', this.pc);
  const res = origEvalCall(name, args);
  console.log('EVALCALL END', name, 'result', res, 'pc', this.pc);
  return res;
};

for (let i = 0; i < 50; i++) {
  const step = interp.step();
  console.log('STEP', i, 'pc', interp.currentLineIndex, 'desc', step?.description, 'error', interp.error, 'finished', interp.finished);
  if (interp.finished || interp.error) break;
}
console.log('FINAL', interp.finished, interp.error, interp.returnValue, interp.getVariables());

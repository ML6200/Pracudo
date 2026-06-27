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
interp.enterFunction = function (fn: any, args: any, assignTarget: any, returnToCurrentLine = false) {
  console.log('ENTER', fn.name, 'pc', this.pc, 'returnToCurrentLine', returnToCurrentLine, 'assignTarget', assignTarget, 'callStackLen', this.callStack.length);
  const ret = origEnter(fn, args, assignTarget, returnToCurrentLine);
  console.log('ENTERED', 'callStackLen', this.callStack.length, 'frame', this.callStack[this.callStack.length-1]);
  return ret;
};
const origStep = interp.step.bind(interp);
interp.step = function () {
  console.log('STEP BEGIN pc', this.pc, 'endPc', this.endPc, 'callStackLen', this.callStack.length);
  const res = origStep();
  console.log('STEP END pc', this.pc, 'endPc', this.endPc, 'callStackLen', this.callStack.length, 'finished', this.finished, 'error', this.error, 'returnValue', this.returnValue);
  if (res) console.log('STEP RES', res.lineIndex, res.lineNumber, res.description);
  return res;
};
for (let i = 0; i < 10; i++) {
  const step = interp.step();
  console.log('OUTER ITER', i, 'returned', step?.lineIndex, step?.description, 'pc', interp.currentLineIndex);
  if (interp.finished || interp.error) break;
}
console.log('FINAL fin', interp.finished, 'err', interp.error, 'ret', interp.returnValue, 'vars', interp.getVariables());

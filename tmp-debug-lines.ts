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
console.log('lines:');
interp.lines.forEach((line:any, i:number) => console.log(i, line.lineNumber, JSON.stringify(line.raw)));
console.log('classified:');
interp.classified.forEach((cl:any, i:number) => console.log(i, cl.kind, JSON.stringify(cl)));
console.log('startPc', interp.startPc, 'endPc', interp.endPc);

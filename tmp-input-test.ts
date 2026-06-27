import { parseAlgorithm } from './src/parser.ts';
import { parseInputDeclaration } from './src/interpreter.ts';
const text = `függvény KIVÁLOGATAS MAXIMUMKIVÁLASZTAS(x : T tömb, n : egész, P : logikai)`;
const algo = parseAlgorithm(text);
console.log('algo.inputs=', JSON.stringify(algo.inputs));
console.log('funcParams=', JSON.stringify(algo.lines));
const params = parseInputDeclaration(algo.inputs, ['x','n','P']);
console.log(params);

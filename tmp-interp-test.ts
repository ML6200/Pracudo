import { parseAlgorithm } from './src/parser.ts';
import { Interpreter } from './src/interpreter.ts';

const text = `függvény KIVÁLOGATAS MAXIMUMKIVÁLASZTAS(x : T tömb, n : egész, P : logikai)
maxérték <- -∞
ciklus i <- 1-től n-ig
ha P(x[i]) ∧ (x[i] > maxérték) akkor
max <- 1
maxérték <- x[i]
elágazás vége
ciklus vége
van <- (maxérték > -∞)
ha van akkor
vissza (van, max, maxérték)
különben
vissza van
elágazás vége
`;
const algo = parseAlgorithm(text);
const interp = new Interpreter(algo);
interp.setInputs({ x: [1,2,4,3,5], n: 5, P: 'e % 2 = 0' });
console.log('funcParams', interp.funcParams);
while (!interp.finished && !interp.error) {
  const step = interp.step();
  if (!step) break;
  console.log(step.lineNumber, step.description, interp.getVariables());
}
if (interp.error) console.error('ERROR', interp.error);
else console.log('DONE', interp.returnValue, interp.getVariables());

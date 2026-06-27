import { parseAlgorithm } from './src/parser.ts';
import { Interpreter } from './src/interpreter.ts';
const text = `Bemenet: x - T tömb, bal - egész, center - egész, jobb - egész; ahol T összehasonlítható
Kimenet: x - T tömb
eljárás ÖSSZEFÉSÜLŐRENDEZÉS(címszerint x : T tömb, bal : egész, jobb : egész)
    ha bal < jobb akkor
        center ← ⌊(bal + jobb) / 2⌋
        ÖSSZEFÉSÜLŐRENDEZÉS(x, bal, center)
        ÖSSZEFÉSÜLŐRENDEZÉS(x, center + 1, jobb)
        ÖSSZEFÉSÜL(x, bal, center, jobb)
    elágazás vége
eljárás vége
eljárás ÖSSZEFÉSÜL(címszerint x : T tömb, bal : egész, center : egész, jobb : egész)
    n1 ← center - bal + 1
    n2 ← jobb - center
    y1 ← LÉTREHOZ(T)[n1 + 1]
    ciklus i ← 1-től n1-ig
        y1[i] ← x[bal + i - 1]
    ciklus vége
    y2 ← LÉTREHOZ(T)[n2 + 1]
    ciklus j ← 1-től n2-ig
        y2[j] ← x[center + j]
    ciklus vége
    y1[n1 + 1] ← +∞
    y2[n2 + 1] ← +∞
    i ← 1
    j ← 1
    ciklus k ← bal-tól jobb-ig
        ha y1[i] ≤ y2[j] akkor
            x[k] ← y1[i]
            i ← i + 1
        különben
            x[k] ← y2[j]
            j ← j + 1
        elágazás vége
    ciklus vége
eljárás vége
`;
const algo = parseAlgorithm(text);
const interp = new Interpreter(algo);
interp.setInputs({ x: [2,3,5,4,1,3,5], bal: 1, jobb: 7 });
let count=0;
while(!interp.finished && !interp.error && count<200){
  const step = interp.step();
  if(step) console.log(step.lineNumber, step.description, interp.getVariables());
  count++;
}
console.log('ERROR', interp.error);
console.log('DONE', interp.returnValue, interp.getVariables());

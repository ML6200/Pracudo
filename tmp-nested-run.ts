import { parseAlgorithm } from './src/parser.ts';
import { Interpreter } from './src/interpreter.ts';
const text = `Bemenet: x - T tömb, bal - egész, jobb - egész; ahol T összehasonlítható
Kimenet: x - T tömb, idx - egész
eljárás GYOSRENDEZÉS(címszerint x : T tömb, bal : egész, jobb : egész)
    idx ← SZÉTVÁLOGAT(x, bal, jobb)
    ha idx > bal + 1 akkor
        GYOSRENDEZÉS(x, bal, idx - 1)
    elágazás vége
    ha idx < jobb - 1 akkor
        GYOSRENDEZÉS(x, idx + 1, jobb)
    elágazás vége
eljárás vége
függvény SZÉTVÁLOGAT(címszerint x : T tömb, bal : egész, jobb : egész)
    segéd ← x[bal]
    ciklus amíg bal < jobb
        ciklus amíg (bal < jobb) ∧ (x[jobb] > segéd)
            jobb ← jobb - 1
        ciklus vége
        ha bal < jobb akkor
            x[bal] ← x[jobb]
            bal ← bal + 1
        ciklus amíg (bal < jobb) ∧ (x[bal] ≤ segéd)
            bal ← bal + 1
        ciklus vége
        ha bal < jobb akkor
            x[jobb] ← x[bal]
            jobb ← jobb - 1
        elágazás vége
    elágazás vége
ciklus vége
idx ← bal
x[idx] ← segéd
vissza idx
függvény vége
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

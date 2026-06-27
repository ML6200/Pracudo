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
console.log('lines', algo.lines.map(l => ({n:l.lineNumber,raw:l.raw,indent:l.indent, tokens:l.tokens.map(t=>t.value)})));
const interp = new Interpreter(algo);
console.log('funcParams', interp.funcParams);
try {
  for (let i=0;i<20;i++) {
    const step=interp.step();
    console.log('step', step?.lineNumber, step?.description, interp.getVariables());
    if(interp.finished || interp.error) break;
  }
  console.log('error', interp.error, 'return', interp.returnValue);
} catch(e) { console.error('EX', e); }

// interpreter.ts - Importok
import { Algorithm, PseudoLine } from "./parser";

export type Value = number | boolean | Value[] | string; // ÚJ: Hozzáadva a string típus a predikátumokhoz

export interface InputParam {
  name: string;
  type: string;
  isArray: boolean;
}

export interface ExecutionStep {
  lineIndex: number;
  lineNumber: number;
  variables: Record<string, string>;
  description: string;
}

type Expr =
  | { kind: "number"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "var"; name: string }
  | { kind: "index"; array: Expr; index: Expr }
  | { kind: "binary"; op: string; left: Expr; right: Expr }
  | { kind: "unary"; op: string; operand: Expr }
  | { kind: "call"; name: string; args: Expr[] };

type ClassifiedLine =
  | { kind: "func_header"; name: string; params: InputParam[] }
  | { kind: "func_end" }
  | { kind: "assign"; target: string; index: Expr | null; value: Expr }
  | { kind: "if"; condition: Expr }
  | { kind: "else" }
  | { kind: "endif" }
  | { kind: "while"; condition: Expr }
  | { kind: "for"; variable: string; start: Expr; end: Expr; step: Expr | null }
  | { kind: "endloop" }
  | { kind: "return"; value: Expr }
  | { kind: "call_stmt"; name: string; args: Expr[] }
  | { kind: "unknown"; raw: string };

interface JumpInfo {
  endLoop?: number;
  elseIndex?: number;
  endIf?: number;
  loopStart?: number;
}

interface FunctionDef {
  name: string;
  start: number;
  end: number;
  params: InputParam[];
}

interface CallFrame {
  returnPc: number;
  returnEnv: Map<string, Value>;
  returnEndPc: number;
  assignTarget?: { target: string; index: Expr | null };
}

// ===== Expression Tokenizer =====

interface ExprToken {
  type:
    | "number"
    | "ident"
    | "op"
    | "lparen"
    | "rparen"
    | "lbracket"
    | "rbracket"
    | "comma"
    | "floor_open"
    | "floor_close"
    | "ceil_open"
    | "ceil_close";
  value: string;
}

function tokenizeExpr(text: string): ExprToken[] {
  const tokens: ExprToken[] = [];
  let i = 0;

  // Többkarakteres operátorok szótára (Lookahead map)
  const multiCharOps: Record<string, string> = {
    "<=": "≤",
    ">=": "≥",
    "!=": "≠",
    "<>": "≠",
    "==": "≡",
    "===": "≡",
    "&&": "∧",
    "||": "∨",
    "<-": "←",
    ":=": "←",
  };

  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }

    if (text[i] === "⌊") {
      tokens.push({ type: "floor_open", value: "⌊" });
      i++;
      continue;
    }
    if (text[i] === "⌋") {
      tokens.push({ type: "floor_close", value: "⌋" });
      i++;
      continue;
    }
    if (text[i] === "⌈") {
      tokens.push({ type: "ceil_open", value: "⌈" });
      i++;
      continue;
    }
    if (text[i] === "⌉") {
      tokens.push({ type: "ceil_close", value: "⌉" });
      i++;
      continue;
    }
    if (text[i] === "∞") {
      tokens.push({ type: "number", value: "Infinity" });
      i++;
      continue;
    }
    if (text[i] === "−" || text[i] === "–") {
      tokens.push({ type: "op", value: "-" });
      i++;
      continue;
    }

    if (/\d/.test(text[i])) {
      let num = "";
      while (i < text.length && /[\d.]/.test(text[i])) {
        num += text[i];
        i++;
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

    if (/[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_]/.test(text[i])) {
      let ident = "";
      while (
        i < text.length &&
        /[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]/.test(text[i])
      ) {
        ident += text[i];
        i++;
      }
      tokens.push({ type: "ident", value: ident });
      continue;
    }

    if (text[i] === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i++;
      continue;
    }
    if (text[i] === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i++;
      continue;
    }
    if (text[i] === "[") {
      tokens.push({ type: "lbracket", value: "[" });
      i++;
      continue;
    }
    if (text[i] === "]") {
      tokens.push({ type: "rbracket", value: "]" });
      i++;
      continue;
    }
    if (text[i] === ",") {
      tokens.push({ type: "comma", value: "," });
      i++;
      continue;
    }

    // Lookahead a többkarakteres operátorokhoz
    let opMatched = false;
    for (const len of [3, 2]) {
      const possibleOp = text.substring(i, i + len);
      if (multiCharOps[possibleOp]) {
        tokens.push({ type: "op", value: multiCharOps[possibleOp] });
        i += len;
        opMatched = true;
        break;
      }
    }
    if (opMatched) continue;

    // 1 karakteres operátor ellenőrzés
    if ("+-*/%<>=≤≥≠≡∧∨¬←".includes(text[i])) {
      tokens.push({ type: "op", value: text[i] });
      i++;
      continue;
    }

    i++;
  }

  return tokens;
}

// ===== Expression Parser (Recursive Descent) =====

class ExprParser {
  private tokens: ExprToken[];
  private pos: number;

  constructor(tokens: ExprToken[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(): ExprToken | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  advance(): ExprToken {
    return this.tokens[this.pos++];
  }

  parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (
      this.peek()?.value === "∨" ||
      (this.peek()?.type === "ident" && this.peek()?.value === "vagy")
    ) {
      this.advance();
      left = { kind: "binary", op: "∨", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (
      this.peek()?.value === "∧" ||
      (this.peek()?.type === "ident" && this.peek()?.value === "és")
    ) {
      this.advance();
      left = { kind: "binary", op: "∧", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Expr {
    if (
      this.peek()?.value === "¬" ||
      (this.peek()?.type === "ident" && this.peek()?.value === "nem")
    ) {
      this.advance();
      return { kind: "unary", op: "¬", operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAddition();
    const t = this.peek();
    if (
      t?.type === "op" &&
      ["=", "<", ">", "≤", "≥", "≠", "≡"].includes(t.value)
    ) {
      const op = this.advance().value;
      left = { kind: "binary", op, left, right: this.parseAddition() };
    }
    return left;
  }

  private parseAddition(): Expr {
    let left = this.parseMultiplication();
    while (
      this.peek()?.type === "op" &&
      ["+", "-"].includes(this.peek()!.value)
    ) {
      const op = this.advance().value;
      left = { kind: "binary", op, left, right: this.parseMultiplication() };
    }
    return left;
  }

  private parseMultiplication(): Expr {
    let left = this.parseUnary();
    while (
      (this.peek()?.type === "op" &&
        ["*", "/", "%"].includes(this.peek()!.value)) ||
      (this.peek()?.type === "ident" &&
        (this.peek()!.value === "mod" || this.peek()!.value === "div"))
    ) {
      const tok = this.advance();
      const op =
        tok.value === "mod" ? "%" : tok.value === "div" ? "div" : tok.value;
      left = { kind: "binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.peek()?.type === "op" && ["-", "+"].includes(this.peek()!.value)) {
      const op = this.advance().value;
      if (op === "+") return this.parseUnary();
      return { kind: "unary", op: "-", operand: this.parseUnary() };
    }
    return this.parseAtom();
  }

  private parseAtom(): Expr {
    const t = this.peek();
    if (!t) throw new Error("Váratlan kifejezés vége");

    if (t.type === "number") {
      this.advance();
      return { kind: "number", value: parseFloat(t.value) };
    }

    if (t.type === "floor_open") {
      this.advance();
      const inner = this.parseExpr();
      if (this.peek()?.type === "floor_close") this.advance();
      return { kind: "call", name: "FLOOR", args: [inner] };
    }

    if (t.type === "ceil_open") {
      this.advance();
      const inner = this.parseExpr();
      if (this.peek()?.type === "ceil_close") this.advance();
      return { kind: "call", name: "CEIL", args: [inner] };
    }

    if (t.type === "lparen") {
      this.advance();
      const expr = this.parseExpr();
      if (this.peek()?.type === "rparen") this.advance();
      return expr;
    }

    if (t.type === "ident") {
      if (t.value === "igaz") {
        this.advance();
        return { kind: "bool", value: true };
      }
      if (t.value === "hamis") {
        this.advance();
        return { kind: "bool", value: false };
      }
      if (/^inf(inity)?$/i.test(t.value)) {
        this.advance();
        return { kind: "number", value: Infinity };
      }

      this.advance();
      let expr: Expr = { kind: "var", name: t.value };

      if (this.peek()?.type === "lparen") {
        this.advance();
        const args: Expr[] = [];
        if (this.peek()?.type !== "rparen") {
          args.push(this.parseExpr());
          while (this.peek()?.type === "comma") {
            this.advance();
            args.push(this.parseExpr());
          }
        }
        if (this.peek()?.type === "rparen") this.advance();
        expr = { kind: "call", name: t.value, args };
      }

      while (this.peek()?.type === "lbracket") {
        this.advance();
        const index = this.parseExpr();
        if (this.peek()?.type === "rbracket") this.advance();
        expr = { kind: "index", array: expr, index };
      }

      return expr;
    }

    throw new Error(`Váratlan token: ${t.value}`);
  }
}

function parseExpression(text: string): Expr {
  const tokens = tokenizeExpr(text);
  if (tokens.length === 0) throw new Error("Üres kifejezés");
  return new ExprParser(tokens).parseExpr();
}

function parseExprList(text: string): Expr[] {
  const tokens = tokenizeExpr(text);
  if (tokens.length === 0) return [];
  const parser = new ExprParser(tokens);
  const exprs: Expr[] = [parser.parseExpr()];
  while (parser.peek()?.type === "comma") {
    parser.advance();
    exprs.push(parser.parseExpr());
  }
  return exprs;
}

// ===== Line Classifier =====

function classifyLine(raw: string): ClassifiedLine {
  const trimmed = raw.trim();

  const funcMatch = trimmed.match(
      /^(függvény|eljárás)\s+(.+?)\s*\(([^)]*)\)/i,
    );
    if (funcMatch) {
      const params: InputParam[] = [];
      for (const p of funcMatch[3].split(",")) {
        const t = p.trim();
        if (!t) continue;
        const paramMatch = t.match(
          /^(?:címszerint\s+)?([a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*)\s*:\s*(.+)$/i,
        );
        if (paramMatch) {
          const typeStr = paramMatch[2].trim();
          params.push({
            name: paramMatch[1],
            type: typeStr,
            isArray: /tömb/i.test(typeStr),
          });
        } else {
          params.push({ name: t, type: "egész", isArray: false });
        }
      }
      return { kind: "func_header", name: funcMatch[2], params };
    }

  if (/^(függvény|eljárás)\s+vége$/i.test(trimmed)) return { kind: "func_end" };

  const whileMatch = trimmed.match(/^ciklus\s+amíg\s+(.+)$/i);
  if (whileMatch)
    return { kind: "while", condition: parseExpression(whileMatch[1]) };

  if (/^ciklus\s+vége$/i.test(trimmed)) return { kind: "endloop" };

  const forMatch = trimmed.match(
    /^ciklus\s+([a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*)\s*(?:←|<-|:=|=)\s*(.+)$/i,
  );

  if (forMatch) {
    const rangeMatch = forMatch[2].match(
      /^(.+?)(?:\s*-\s*t[oóöő]l|\s+t[oóöő]l)\s+(.+?)(?:\s*-\s*ig|\s+ig)(?:\s+lépésköz\s+(.+))?$/i,
    );
    if (rangeMatch) {
      return {
        kind: "for",
        variable: forMatch[1],
        start: parseExpression(rangeMatch[1]),
        end: parseExpression(rangeMatch[2]),
        step: rangeMatch[3] ? parseExpression(rangeMatch[3]) : null,
      };
    }
  }

  const ifMatch = trimmed.match(/^ha\s+(.+?)\s+akkor$/i);
  if (ifMatch) return { kind: "if", condition: parseExpression(ifMatch[1]) };

  if (/^különben$/i.test(trimmed)) return { kind: "else" };

  if (/^elágazás\s+vége$/i.test(trimmed)) return { kind: "endif" };

  const retMatch = trimmed.match(/^vissza\s+(.+)$/i);
  if (retMatch) return { kind: "return", value: parseExpression(retMatch[1]) };

  const assignMatch = trimmed.match(/^(.+?)\s*(?:←|<-|:=|=)\s*(.+)$/);

  if (assignMatch) {
    const lhs = assignMatch[1].trim();
    const rhs = assignMatch[2].trim();
    const arrMatch = lhs.match(
      /^([a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*)\[(.+)\]$/,
    );
    if (arrMatch) {
      return {
        kind: "assign",
        target: arrMatch[1],
        index: parseExpression(arrMatch[2]),
        value: parseExpression(rhs),
      };
    }
    return {
      kind: "assign",
      target: lhs,
      index: null,
      value: parseExpression(rhs),
    };
  }

  const callMatch = trimmed.match(
    /^([a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*)\s*\((.+)\)$/,
  );
  if (callMatch)
    return {
      kind: "call_stmt",
      name: callMatch[1],
      args: parseExprList(callMatch[2]),
    };

  return { kind: "unknown", raw: trimmed };
}

// ===== Jump Table =====

interface StackEntry {
  kind: "loop" | "if" | "else";
  index: number;
  ifIndex?: number;
}

function buildJumpTable(classified: ClassifiedLine[]): Map<number, JumpInfo> {
  const jumps = new Map<number, JumpInfo>();
  const stack: StackEntry[] = [];

  for (let i = 0; i < classified.length; i++) {
    const cl = classified[i];

    if (cl.kind === "while" || cl.kind === "for") {
      stack.push({ kind: "loop", index: i });
    } else if (cl.kind === "if") {
      stack.push({ kind: "if", index: i });
    } else if (cl.kind === "else") {
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].kind === "if") {
          const ifIdx = stack[j].index;
          jumps.set(ifIdx, { ...jumps.get(ifIdx), elseIndex: i });
          stack[j] = { kind: "else", index: i, ifIndex: ifIdx };
          break;
        }
      }
    } else if (cl.kind === "endif") {
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].kind === "if" || stack[j].kind === "else") {
          const entry = stack.splice(j, 1)[0];
          if (entry.kind === "else") {
            jumps.set(entry.index, { ...jumps.get(entry.index), endIf: i });
            if (entry.ifIndex !== undefined) {
              jumps.set(entry.ifIndex, {
                ...jumps.get(entry.ifIndex),
                endIf: i,
              });
            }
          } else {
            jumps.set(entry.index, { elseIndex: -1, endIf: i });
          }
          break;
        }
      }
    } else if (cl.kind === "endloop") {
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].kind === "loop") {
          const entry = stack.splice(j, 1)[0];
          jumps.set(entry.index, { ...jumps.get(entry.index), endLoop: i });
          jumps.set(i, { loopStart: entry.index });
          break;
        }
      }
    }
  }

  return jumps;
}

// ===== Helpers =====

function asNumber(v: Value): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  throw new Error("Szám típus szükséges");
}

function asBool(v: Value): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  throw new Error("Logikai típus szükséges");
}

export function formatValue(v: Value): string {
  if (typeof v === "string") return v; // <- ÚJ: Szövegek (predikátumok) natív visszaadása
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return v > 0 ? "Infinity" : "-Infinity";
    return Number.isInteger(v) ? v.toString() : v.toFixed(2);
  }
  if (typeof v === "boolean") return v ? "igaz" : "hamis";
  if (Array.isArray(v)) return `[${v.map(formatValue).join(", ")}]`;
  return String(v);
}

export function parseInputDeclaration(
  inputStr: string,
  funcParams: string[] | InputParam[],
): InputParam[] {
  const typeMap = new Map<string, { type: string; isArray: boolean }>();

  const typedParams = funcParams.filter(
    (p): p is InputParam => typeof p !== "string",
  );

  for (const param of typedParams) {
    typeMap.set(param.name, {
      type: param.type,
      isArray: param.isArray,
    });
  }

  if (inputStr.trim()) {
    const segments = inputStr.split(",");
    let pendingNames: string[] = [];

    for (const seg of segments) {
      const trimmed = seg.trim();
      const match = trimmed.match(
        /^([a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*)\s*[––—-]\s*(.+)$/,
      );
      const colonMatch = trimmed.match(
        /^([a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*)\s*:\s*(.+)$/,
      );
      if (match || colonMatch) {
        const name = (match || colonMatch)![1];
        const typeStr = ((match || colonMatch)![2] || "").trim();
        pendingNames.push(name);
        const isArray = /tömb/i.test(typeStr);
        for (const nameEntry of pendingNames) {
          typeMap.set(nameEntry, { type: typeStr, isArray });
        }
        pendingNames = [];
      } else {
        const nameMatch = trimmed.match(
          /^([a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*)$/,
        );
        if (nameMatch) pendingNames.push(nameMatch[1]);
      }
    }
  }

  const names =
    typedParams.length > 0
      ? typedParams.map((p) => p.name)
      : [...typeMap.keys()];

  return names.map((name) => ({
    name,
    type: typeMap.get(name)?.type ||
      typedParams.find((p) => p.name === name)?.type ||
      "egész",
    isArray:
      typeMap.get(name)?.isArray ||
      typedParams.find((p) => p.name === name)?.isArray ||
      false,
  }));
}

// ===== Interpreter =====

export class Interpreter {
  private lines: PseudoLine[];
  private classified: ClassifiedLine[];
  private jumps: Map<number, JumpInfo>;
  private functions: Map<string, FunctionDef>;
  private callStack: CallFrame[];
  private env: Map<string, Value>;
  private pc: number;
  private startPc: number;
  private endPc: number;
  private _finished: boolean;
  private _returnValue: Value | null;
  private _error: string | null;
  private history: ExecutionStep[];
  private forState: Map<number, { endVal: number; step: number }>;
  private stepCount: number;
  private maxSteps = 10000;
  public funcParams: InputParam[];

  constructor(algo: Algorithm) {
    this.lines = algo.lines;
    this.classified = algo.lines.map((l) => classifyLine(l.raw));
    this.jumps = buildJumpTable(this.classified);
    this.functions = this.buildFunctionTable(this.classified);
    this.callStack = [];
    this.env = new Map();
    this.history = [];
    this.forState = new Map();
    this._finished = false;
    this._returnValue = null;
    this._error = null;
    this.stepCount = 0;
    this.funcParams = [];

    const headerIdx = this.classified.findIndex(
      (c) => c.kind === "func_header",
    );

    if (headerIdx >= 0) {
      this.funcParams = (
        this.classified[headerIdx] as Extract<
          ClassifiedLine,
          { kind: "func_header" }
        >
      ).params;
    }

    let currentTopLevelStart: number | null = null;
    const topLevelRanges: Array<{ start: number; end: number }> = [];
    let funcDepth = 0;

    for (let i = 0; i < this.classified.length; i++) {
      const cl = this.classified[i];
      if (cl.kind === "func_header") {
        if (funcDepth === 0 && currentTopLevelStart !== null) {
          topLevelRanges.push({
            start: currentTopLevelStart,
            end: i - 1,
          });
          currentTopLevelStart = null;
        }
        funcDepth++;
      } else if (cl.kind === "func_end") {
        funcDepth = Math.max(0, funcDepth - 1);
      } else if (funcDepth === 0) {
        if (currentTopLevelStart === null) currentTopLevelStart = i;
      }
    }

    if (currentTopLevelStart !== null) {
      topLevelRanges.push({
        start: currentTopLevelStart,
        end: this.classified.length - 1,
      });
    }

    if (topLevelRanges.length > 0) {
      this.startPc = topLevelRanges[0].start;
      this.endPc = topLevelRanges[topLevelRanges.length - 1].end;
    } else if (headerIdx >= 0) {
      this.startPc = headerIdx + 1;
      const endIdx = this.classified.findIndex(
        (c, i) => i > headerIdx && c.kind === "func_end",
      );
      this.endPc = endIdx >= 0 ? endIdx : this.lines.length - 1;
    } else {
      this.startPc = 0;
      this.endPc = this.lines.length - 1;
    }

    this.pc = this.startPc;
  }

  private buildFunctionTable(classified: ClassifiedLine[]): Map<string, FunctionDef> {
    const functions = new Map<string, FunctionDef>();
    const stack: Array<{ name: string; start: number; params: InputParam[] }> = [];

    for (let i = 0; i < classified.length; i++) {
      const cl = classified[i];
      if (cl.kind === "func_header") {
        stack.push({ name: cl.name, start: i + 1, params: cl.params });
      } else if (cl.kind === "func_end") {
        const entry = stack.pop();
        if (entry) {
          functions.set(entry.name.toUpperCase(), {
            name: entry.name,
            start: entry.start,
            end: i,
            params: entry.params,
          });
        }
      }
    }

    return functions;
  }

  private findNextExecutableLine(from: number): number {
    for (let i = from; i < this.classified.length; i++) {
      const kind = this.classified[i].kind;
      if (kind !== "func_header" && kind !== "func_end") return i;
    }
    return this.classified.length;
  }

  private enterFunction(
    fn: FunctionDef,
    args: Value[],
    assignTarget?: { target: string; index: Expr | null },
    returnToCurrentLine = false,
  ): void {
    if (args.length !== fn.params.length)
      throw new Error(`Hibás paraméterszám: ${fn.name} vár ${fn.params.length}-t`);

    this.callStack.push({
      returnPc: returnToCurrentLine
        ? this.pc
        : this.findNextExecutableLine(this.pc + 1),
      returnEnv: this.env,
      returnEndPc: this.endPc,
      assignTarget,
    });

    this.env = new Map<string, Value>();
    for (let i = 0; i < fn.params.length; i++) {
      this.env.set(fn.params[i].name, args[i]);
    }
    this.pc = fn.start;
    this.endPc = fn.end;
  }

  setInputs(inputs: Record<string, Value>): void {
    for (const [key, val] of Object.entries(inputs)) {
      this.env.set(key, val);
    }
  }

  reset(): void {
    this.env = new Map();
    this.pc = this.startPc;
    this._finished = false;
    this._returnValue = null;
    this._error = null;
    this.history = [];
    this.forState = new Map();
    this.stepCount = 0;
  }

  get finished(): boolean {
    return this._finished;
  }
  get error(): string | null {
    return this._error;
  }
  get returnValue(): Value | null {
    return this._returnValue;
  }
  get currentLineIndex(): number {
    return this.pc;
  }
  get steps(): ExecutionStep[] {
    return this.history;
  }

  getVariables(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of this.env) result[k] = formatValue(v);
    return result;
  }

  step(): ExecutionStep | null {
    if (this._finished || this._error) return null;

    if (this.pc < 0 || this.pc > this.endPc) {
      if (this.callStack.length > 0) {
        const frame = this.callStack.pop()!;
        this.env = frame.returnEnv;
        this.endPc = frame.returnEndPc;
        this.pc = frame.returnPc;
      } else {
        this._finished = true;
        return null;
      }
    }

    if (this.stepCount++ > this.maxSteps) {
      this._error = "Végtelen ciklus! (maximum 10000 lépés)";
      this._finished = true;
      return {
        lineIndex: this.pc,
        lineNumber: this.lines[this.pc]?.lineNumber ?? 0,
        variables: this.getVariables(),
        description: this._error,
      };
    }

    const line = this.lines[this.pc];
    const cl = this.classified[this.pc];
    const currentPc = this.pc;
    let desc = "";

    try {
      desc = this.executeLine(cl, currentPc);
    } catch (e) {
      this._error = (e as Error).message;
      this._finished = true;
      desc = `Hiba: ${this._error}`;
    }

    const s: ExecutionStep = {
      lineIndex: currentPc,
      lineNumber: line.lineNumber,
      variables: this.getVariables(),
      description: desc,
    };
    this.history.push(s);
    return s;
  }

  private executeLine(cl: ClassifiedLine, pc: number): string {
    switch (cl.kind) {
      case "assign": {
        if (
          cl.value.kind === "call" &&
          this.functions.has(cl.value.name.toUpperCase())
        ) {
          const fn = this.functions.get(cl.value.name.toUpperCase())!;
          const argVals = cl.value.args.map((a) => this.evalExpr(a));
          this.enterFunction(fn, argVals, {
            target: cl.target,
            index: cl.index,
          });
          return `${fn.name} belépés`;
        }

        const val = this.evalExpr(cl.value);
        if (cl.index !== null) {
          const idx = asNumber(this.evalExpr(cl.index));
          let arr = this.env.get(cl.target);
          if (arr === undefined) {
            arr = [];
            this.env.set(cl.target, arr);
          }
          if (!Array.isArray(arr)) throw new Error(`${cl.target} nem tömb`);
          while ((arr as Value[]).length < idx) (arr as Value[]).push(0);
          (arr as Value[])[idx - 1] = val;
          this.pc++;
          return `${cl.target}[${idx}] ← ${formatValue(val)}`;
        }
        this.env.set(cl.target, val);
        this.pc++;
        return `${cl.target} ← ${formatValue(val)}`;
      }

      case "if": {
        const cond = this.evalExpr(cl.condition);
        const jump = this.jumps.get(pc);
        if (asBool(cond)) {
          this.pc++;
          return "feltétel igaz";
        }
        this.pc =
          jump?.elseIndex !== undefined && jump.elseIndex >= 0
            ? jump.elseIndex + 1
            : jump?.endIf !== undefined
              ? jump.endIf + 1
              : this.pc + 1;
        return "feltétel hamis";
      }

      case "else": {
        const jump = this.jumps.get(pc);
        this.pc = jump?.endIf !== undefined ? jump.endIf + 1 : this.pc + 1;
        return "különben átugrás";
      }

      case "endif": {
        this.pc++;
        return "elágazás vége";
      }

      case "while": {
        const cond = this.evalExpr(cl.condition);
        const jump = this.jumps.get(pc);
        if (asBool(cond)) {
          this.pc++;
          return "feltétel igaz, ciklus folytatódik";
        }
        this.pc = jump?.endLoop !== undefined ? jump.endLoop + 1 : this.pc + 1;
        return "feltétel hamis, ciklus vége";
      }

      case "for": {
        const jump = this.jumps.get(pc);
        if (!this.forState.has(pc)) {
          const startVal = asNumber(this.evalExpr(cl.start));
          const endVal = asNumber(this.evalExpr(cl.end));
          const stepVal = cl.step ? asNumber(this.evalExpr(cl.step)) : 1;
          this.env.set(cl.variable, startVal);
          this.forState.set(pc, { endVal, step: stepVal });
          const inRange = stepVal > 0 ? startVal <= endVal : startVal >= endVal;
          if (inRange) {
            this.pc++;
            return `${cl.variable} ← ${startVal}`;
          }
          this.pc =
            jump?.endLoop !== undefined ? jump.endLoop + 1 : this.pc + 1;
          this.forState.delete(pc);
          return "ciklus kihagyva";
        }
        const { endVal, step } = this.forState.get(pc)!;
        const current = asNumber(this.env.get(cl.variable)!);
        const inRange = step > 0 ? current <= endVal : current >= endVal;
        if (inRange) {
          this.pc++;
          return `${cl.variable} = ${current}, ciklus folytatódik`;
        }
        this.pc = jump?.endLoop !== undefined ? jump.endLoop + 1 : this.pc + 1;
        this.forState.delete(pc);
        return `${cl.variable} = ${current}, ciklus vége`;
      }

      case "endloop": {
        const jump = this.jumps.get(pc);
        const loopStart = jump?.loopStart;
        if (loopStart !== undefined) {
          const loopLine = this.classified[loopStart];
          if (loopLine.kind === "for") {
            const state = this.forState.get(loopStart);
            if (state) {
              const current = asNumber(this.env.get(loopLine.variable)!);
              const next = current + state.step;
              this.env.set(loopLine.variable, next);
              this.pc = loopStart;
              return `${loopLine.variable} ← ${next}`;
            }
          }
          this.pc = loopStart;
          return "vissza a ciklus elejére";
        }
        this.pc++;
        return "ciklus vége";
      }

      case "return": {
        const returnValue = this.evalExpr(cl.value);
        if (this.callStack.length === 0) {
          this._returnValue = returnValue;
          this._finished = true;
          return `vissza ${formatValue(this._returnValue)}`;
        }

        const frame = this.callStack.pop()!;
        const savedReturn = returnValue;
        this.env = frame.returnEnv;
        this.endPc = frame.returnEndPc;
        this.pc = frame.returnPc;

        if (frame.assignTarget) {
          const { target, index } = frame.assignTarget;
          if (index !== null) {
            const idx = asNumber(this.evalExpr(index));
            let arr = this.env.get(target);
            if (arr === undefined) {
              arr = [];
              this.env.set(target, arr);
            }
            if (!Array.isArray(arr)) throw new Error(`${target} nem tömb`);
            while ((arr as Value[]).length < idx) (arr as Value[]).push(0);
            (arr as Value[])[idx - 1] = savedReturn;
          } else {
            this.env.set(target, savedReturn);
          }
        }

        this._returnValue = savedReturn;
        return `vissza ${formatValue(savedReturn)}`;
      }

      case "call_stmt": {
        if (cl.name.toLowerCase() === "csere") {
          this.handleSwap(cl.args);
          this.pc++;
          return "csere végrehajtva";
        }
        const argVals = cl.args.map((a) => this.evalExpr(a));
        if (this.functions.has(cl.name.toUpperCase())) {
          const fn = this.functions.get(cl.name.toUpperCase())!;
          this.enterFunction(fn, argVals);
          return `${fn.name} belépés`;
        }
        this.pc++;
        return `${cl.name}(${argVals.map(formatValue).join(", ")})`;
      }

      case "func_header":
      case "func_end":
        this.pc++;
        return "";

      case "unknown":
        this.pc++;
        return `[${cl.raw}]`;
    }
  }

  private handleSwap(args: Expr[]): void {
    if (args.length !== 2) throw new Error("csere: 2 argumentum szükséges");
    const [a, b] = args;
    if (
      a.kind === "index" &&
      b.kind === "index" &&
      a.array.kind === "var" &&
      b.array.kind === "var"
    ) {
      const arrA = this.env.get(a.array.name) as Value[];
      const arrB = this.env.get(b.array.name) as Value[];
      if (!Array.isArray(arrA) || !Array.isArray(arrB))
        throw new Error("csere: nem tömb");
      const idxA = asNumber(this.evalExpr(a.index)) - 1;
      const idxB = asNumber(this.evalExpr(b.index)) - 1;
      const temp = arrA[idxA];
      arrA[idxA] = arrB[idxB];
      arrB[idxB] = temp;
    } else if (a.kind === "var" && b.kind === "var") {
      const temp = this.env.get(a.name);
      this.env.set(a.name, this.env.get(b.name)!);
      this.env.set(b.name, temp!);
    } else {
      throw new Error("csere: nem támogatott argumentum típus");
    }
  }

  private evalExpr(expr: Expr): Value {
    switch (expr.kind) {
      case "number":
        return expr.value;
      case "bool":
        return expr.value;
      case "var": {
        const val = this.env.get(expr.name);
        if (val === undefined)
          throw new Error(`Nem definiált változó: ${expr.name}`);
        return val;
      }
      case "index": {
        // Memóriafoglalás (LÉTREHOZ) operátor elfogása
        if (
          expr.array.kind === "call" &&
          (expr.array.name.toUpperCase() === "LÉTREHOZ" ||
            expr.array.name.toUpperCase() === "LETREHOZ")
        ) {
          const size = asNumber(this.evalExpr(expr.index));
          return new Array(size).fill(0);
        }

        const arr = this.evalExpr(expr.array);
        const idx = asNumber(this.evalExpr(expr.index));
        if (!Array.isArray(arr)) throw new Error("Nem tömb");
        if (idx < 1 || idx > arr.length)
          throw new Error(`Index határon kívül: ${idx} (méret: ${arr.length})`);
        return arr[idx - 1];
      }

      case "binary":
        return this.evalBinary(expr.op, expr.left, expr.right);
      case "unary": {
        const operand = this.evalExpr(expr.operand);
        if (expr.op === "-") return -asNumber(operand);
        if (expr.op === "¬") return !asBool(operand);
        throw new Error(`Ismeretlen operátor: ${expr.op}`);
      }
      case "call":
        return this.evalCall(expr.name, expr.args);
    }
  }

  private evalBinary(op: string, leftExpr: Expr, rightExpr: Expr): Value {
    if (op === "∧") {
      const left = asBool(this.evalExpr(leftExpr));
      if (!left) return false;
      return asBool(this.evalExpr(rightExpr));
    }
    if (op === "∨") {
      const left = asBool(this.evalExpr(leftExpr));
      if (left) return true;
      return asBool(this.evalExpr(rightExpr));
    }

    const left = this.evalExpr(leftExpr);
    const right = this.evalExpr(rightExpr);

    switch (op) {
      case "+":
        return asNumber(left) + asNumber(right);
      case "-":
        return asNumber(left) - asNumber(right);
      case "*":
        return asNumber(left) * asNumber(right);
      case "/": {
        const r = asNumber(right);
        if (r === 0) throw new Error("Nullával osztás");
        return asNumber(left) / r;
      }
      case "%":
        return asNumber(left) % asNumber(right);
      case "div":
        return Math.floor(asNumber(left) / asNumber(right));
      case "<":
        return asNumber(left) < asNumber(right);
      case ">":
        return asNumber(left) > asNumber(right);
      case "≤":
        return asNumber(left) <= asNumber(right);
      case "≥":
        return asNumber(left) >= asNumber(right);
      case "=":
      case "≡":
        return left === right;
      case "≠":
        return left !== right;
      default:
        throw new Error(`Ismeretlen operátor: ${op}`);
    }
  }

  private evalCall(name: string, argExprs: Expr[]): Value {
    const args = argExprs.map((a) => this.evalExpr(a));

    // ÚJ BLOKK: Predikátumok (függvény paraméterek) kezelése
    if (this.env.has(name)) {
      const rule = this.env.get(name);
      if (typeof rule === "string") {
        const oldE = this.env.get("e");
        this.env.set("e", args[0]);

        try {
          const expr = parseExpression(rule);
          const result = this.evalExpr(expr);
          if (oldE !== undefined) this.env.set("e", oldE);
          else this.env.delete("e");
          return result;
        } catch (err) {
          throw new Error(
            `Hibás predikátum (${name}): ${(err as Error).message}`,
          );
        }
      }
    }

    const upper = name.toUpperCase();
    if (this.functions.has(upper)) {
      const fn = this.functions.get(upper)!;
      const initialDepth = this.callStack.length;
      const previousReturnValue = this._returnValue;
      this._returnValue = null;
      this.enterFunction(fn, args, undefined, true);

      while (
        !this._finished &&
        !this._error &&
        this.callStack.length > initialDepth
      ) {
        const step = this.step();
        if (!step) break;
      }

      const result = this._returnValue;
      this._returnValue = previousReturnValue;
      if (this._error) throw new Error(this._error);
      if (result === null) throw new Error(`A függvény nem adott visszatérési értéket: ${name}`);
      return result;
    }

    // 3. BEÉPÍTETT FÜGGVÉNYEK
    if (upper === "MAX") return Math.max(asNumber(args[0]), asNumber(args[1]));
    if (upper === "MIN") return Math.min(asNumber(args[0]), asNumber(args[1]));
    if (upper === "ABS") return Math.abs(asNumber(args[0]));
    if (upper === "FLOOR" || upper === "PADLÓ")
      return Math.floor(asNumber(args[0]));
    if (upper === "CEIL" || upper === "PLAFON")
      return Math.ceil(asNumber(args[0]));
    if (upper === "MÉRET" || upper === "HOSSZ") {
      if (!Array.isArray(args[0])) throw new Error("méret: nem tömb");
      return args[0].length;
    }
    throw new Error(`Ismeretlen függvény: ${name}`);
  }
}

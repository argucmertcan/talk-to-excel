// Formül motoru: [Sütun] referansları, + - * / , karşılaştırmalar, & (metin birleştirme)
// ve birkaç fonksiyon. eval kullanmaz; LLM'den gelen formül sadece bu dilde çalışabilir.
import type { CellValue, Row } from "./types";

type Tok = { t: "num"; v: number } | { t: "str"; v: string } | { t: "col"; v: string } | { t: "id"; v: string } | { t: "op"; v: string };

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "[") {
      const j = src.indexOf("]", i);
      if (j < 0) throw new Error("Kapanmayan [ ]");
      out.push({ t: "col", v: src.slice(i + 1, j) });
      i = j + 1;
    } else if (c === '"' || c === "'") {
      const j = src.indexOf(c, i + 1);
      if (j < 0) throw new Error("Kapanmayan tırnak");
      out.push({ t: "str", v: src.slice(i + 1, j) });
      i = j + 1;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: "num", v: parseFloat(src.slice(i, j)) });
      i = j;
    } else if (/[A-Za-zÇĞİÖŞÜçğıöşü_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-zÇĞİÖŞÜçğıöşü_0-9]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j).toUpperCase() });
      i = j;
    } else {
      const two = src.slice(i, i + 2);
      if ([">=", "<=", "!=", "<>"].includes(two)) { out.push({ t: "op", v: two === "<>" ? "!=" : two }); i += 2; }
      else if ("+-*/()<>=,&".includes(c)) { out.push({ t: "op", v: c }); i++; }
      else throw new Error(`Beklenmeyen karakter: ${c}`);
    }
  }
  return out;
}

type Node =
  | { k: "lit"; v: CellValue }
  | { k: "col"; v: string }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "neg"; a: Node }
  | { k: "fn"; name: string; args: Node[] };

const PREC: Record<string, number> = { "=": 1, "!=": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4 };

export function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const expectOp = (v: string) => {
    const t = toks[p++];
    if (!t || t.t !== "op" || t.v !== v) throw new Error(`"${v}" bekleniyordu`);
  };
  function primary(): Node {
    const t = toks[p++];
    if (!t) throw new Error("Formül eksik");
    if (t.t === "num" || t.t === "str") return { k: "lit", v: t.v };
    if (t.t === "col") return { k: "col", v: t.v };
    if (t.t === "op" && t.v === "-") return { k: "neg", a: primary() };
    if (t.t === "op" && t.v === "(") { const e = expr(0); expectOp(")"); return e; }
    if (t.t === "id") {
      expectOp("(");
      const args: Node[] = [];
      if (!(peek()?.t === "op" && peek()!.v === ")")) {
        args.push(expr(0));
        while (peek()?.t === "op" && peek()!.v === ",") { p++; args.push(expr(0)); }
      }
      expectOp(")");
      return { k: "fn", name: t.v, args };
    }
    throw new Error("Formül çözülemedi");
  }
  function expr(min: number): Node {
    let left = primary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || !(t.v in PREC) || PREC[t.v] < min) return left;
      p++;
      left = { k: "bin", op: t.v, a: left, b: expr(PREC[t.v] + 1) };
    }
  }
  const n = expr(0);
  if (p < toks.length) throw new Error("Formülün sonunda fazlalık var");
  return n;
}

const num = (v: CellValue) => (typeof v === "number" ? v : v instanceof Date ? v.getTime() : parseFloat(String(v ?? "")));

export function evaluate(n: Node, row: Row): CellValue {
  switch (n.k) {
    case "lit": return n.v;
    case "col": return row[n.v] ?? null;
    case "neg": return -num(evaluate(n.a, row));
    case "bin": {
      const a = evaluate(n.a, row), b = evaluate(n.b, row);
      switch (n.op) {
        case "+": return num(a) + num(b);
        case "-": return num(a) - num(b);
        case "*": return num(a) * num(b);
        case "/": return num(b) === 0 ? null : num(a) / num(b);
        case "&": return `${a ?? ""}${b ?? ""}`;
        case "=": return String(a) === String(b) || num(a) === num(b) ? 1 : 0;
        case "!=": return String(a) !== String(b) && num(a) !== num(b) ? 1 : 0;
        case "<": return num(a) < num(b) ? 1 : 0;
        case ">": return num(a) > num(b) ? 1 : 0;
        case "<=": return num(a) <= num(b) ? 1 : 0;
        case ">=": return num(a) >= num(b) ? 1 : 0;
      }
      return null;
    }
    case "fn": {
      const v = n.args.map((a) => evaluate(a, row));
      switch (n.name) {
        case "ROUND": return Math.round(num(v[0]) * 10 ** num(v[1] ?? 0)) / 10 ** num(v[1] ?? 0);
        case "ABS": return Math.abs(num(v[0]));
        case "IF": return v[0] && v[0] !== 0 ? v[1] : v[2] ?? null;
        case "MONTH": return v[0] instanceof Date ? MONTHS[v[0].getMonth()] : null;
        case "QUARTER": return v[0] instanceof Date ? `Ç${Math.floor(v[0].getMonth() / 3) + 1}` : null;
        case "YEAR": return v[0] instanceof Date ? v[0].getFullYear() : null;
        case "WEEKDAY": return v[0] instanceof Date ? ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][v[0].getDay()] : null;
        case "MIN": return Math.min(...v.map(num));
        case "MAX": return Math.max(...v.map(num));
      }
      throw new Error(`Bilinmeyen fonksiyon: ${n.name}`);
    }
  }
}

export function columnsIn(n: Node): string[] {
  switch (n.k) {
    case "col": return [n.v];
    case "bin": return [...columnsIn(n.a), ...columnsIn(n.b)];
    case "neg": return columnsIn(n.a);
    case "fn": return n.args.flatMap(columnsIn);
    default: return [];
  }
}

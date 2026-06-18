import type { AggregationType } from '../types';

/**
 * Calculated-measure formula engine.
 *
 * Grammar (whitespace-insensitive):
 *   expr    := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := number | '(' expr ')' | '-' factor | call
 *   call    := ident '(' [ string ] ')'
 *
 * `ident` is an aggregation name (sum, average, count, min, max, ...). The
 * string argument is the source field; `count()` may omit it.
 *
 * Example: `sum("price") * sum("quantity")`, `sum("revenue") / count()`.
 */

export interface AggRef {
  aggregation: AggregationType;
  field: string | null;
}

export type AggResolver = (aggregation: AggregationType, field: string | null) => number | null;

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }
  | { kind: 'neg'; operand: Node }
  | { kind: 'agg'; ref: AggRef };

const FUNCTION_ALIASES: Record<string, AggregationType> = {
  sum: 'sum',
  count: 'count',
  distinctcount: 'distinctCount',
  average: 'average',
  avg: 'average',
  mean: 'average',
  median: 'median',
  min: 'min',
  max: 'max',
  product: 'product',
  first: 'first',
  last: 'last',
  stdev: 'stdev',
  stdevp: 'stdevp',
  var: 'var',
  varp: 'varp',
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let str = '';
      while (j < input.length && input[j] !== quote) {
        str += input[j];
        j += 1;
      }
      tokens.push({ kind: 'str', value: str });
      i = j + 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.eE+-]/.test(input[j]!)) {
        // Stop at operators that aren't part of an exponent.
        if ((input[j] === '+' || input[j] === '-') && !/[eE]/.test(input[j - 1] ?? '')) break;
        j += 1;
      }
      const slice = input.slice(i, j);
      tokens.push({ kind: 'num', value: Number(slice) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j]!)) j += 1;
      tokens.push({ kind: 'ident', value: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new SyntaxError(`Unexpected character '${ch}' in formula`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.expr();
    if (this.pos < this.tokens.length) {
      throw new SyntaxError('Unexpected trailing tokens in formula');
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expr(): Node {
    let left = this.term();
    let t = this.peek();
    while (t?.kind === 'op' && (t.value === '+' || t.value === '-')) {
      this.pos += 1;
      const right = this.term();
      left = { kind: 'binary', op: t.value, left, right };
      t = this.peek();
    }
    return left;
  }

  private term(): Node {
    let left = this.factor();
    let t = this.peek();
    while (t?.kind === 'op' && (t.value === '*' || t.value === '/')) {
      this.pos += 1;
      const right = this.factor();
      left = { kind: 'binary', op: t.value, left, right };
      t = this.peek();
    }
    return left;
  }

  private factor(): Node {
    const t = this.peek();
    if (!t) throw new SyntaxError('Unexpected end of formula');
    if (t.kind === 'op' && t.value === '-') {
      this.pos += 1;
      return { kind: 'neg', operand: this.factor() };
    }
    if (t.kind === 'num') {
      this.pos += 1;
      return { kind: 'num', value: t.value };
    }
    if (t.kind === 'lparen') {
      this.pos += 1;
      const node = this.expr();
      const close = this.peek();
      if (close?.kind !== 'rparen') throw new SyntaxError('Expected )');
      this.pos += 1;
      return node;
    }
    if (t.kind === 'ident') {
      return this.call(t.value);
    }
    throw new SyntaxError(`Unexpected token in formula: ${JSON.stringify(t)}`);
  }

  private call(name: string): Node {
    this.pos += 1; // consume ident
    const open = this.peek();
    if (open?.kind !== 'lparen') throw new SyntaxError(`Expected ( after ${name}`);
    this.pos += 1;
    let field: string | null = null;
    const arg = this.peek();
    if (arg?.kind === 'str') {
      field = arg.value;
      this.pos += 1;
    }
    const close = this.peek();
    if (close?.kind !== 'rparen') throw new SyntaxError(`Expected ) after ${name}(`);
    this.pos += 1;
    const aggregation = FUNCTION_ALIASES[name.toLowerCase()];
    if (!aggregation) throw new SyntaxError(`Unknown aggregation function '${name}'`);
    return { kind: 'agg', ref: { aggregation, field } };
  }
}

export interface CompiledFormula {
  references: AggRef[];
  evaluate: (resolver: AggResolver) => number | null;
}

function collect(node: Node, refs: AggRef[]): void {
  switch (node.kind) {
    case 'agg':
      refs.push(node.ref);
      break;
    case 'binary':
      collect(node.left, refs);
      collect(node.right, refs);
      break;
    case 'neg':
      collect(node.operand, refs);
      break;
  }
}

function evalNode(node: Node, resolver: AggResolver): number | null {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'agg':
      return resolver(node.ref.aggregation, node.ref.field);
    case 'neg': {
      const v = evalNode(node.operand, resolver);
      return v == null ? null : -v;
    }
    case 'binary': {
      const l = evalNode(node.left, resolver);
      const r = evalNode(node.right, resolver);
      if (l == null || r == null) return null;
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return r === 0 ? null : l / r;
      }
    }
  }
}

/** Compile a formula string into references + an evaluator. Throws on syntax errors. */
export function compileFormula(formula: string): CompiledFormula {
  const ast = new Parser(tokenize(formula)).parse();
  const references: AggRef[] = [];
  collect(ast, references);
  return {
    references,
    evaluate: (resolver) => evalNode(ast, resolver),
  };
}

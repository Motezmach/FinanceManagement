import { fromCents, subtractMoney, toCents } from "../utils";

export type Op = "+" | "-" | "*" | "/";

export type NumberSource = "typed" | "picked" | "result";

export type Token =
  | { type: "num"; value: number; label?: string; source?: NumberSource }
  | { type: "op"; op: Op }
  | { type: "pct" };

export type CalculatorError = "divideByZero" | "tooLarge";

export type Evaluation = { ok: true; value: number } | { ok: false; error: CalculatorError };

/** Past this, doubles can no longer hold every cent. */
const MAX_MAGNITUDE = 1e15;
const MAX_DRAFT_DIGITS = 15;
const MAX_DRAFT_DECIMALS = 6;

function precise(value: number) {
  return Number(value.toPrecision(15));
}

function isWholeCents(value: number) {
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
}

// Money stays in integer cents. A fraction of a cent can only come from ÷ or %, and it is
// kept until the end: rounding it here would turn `10 ÷ 3 =` then `× 3` into 9.99.
function add(a: number, b: number) {
  if (isWholeCents(a) && isWholeCents(b)) return fromCents(toCents(a) + toCents(b));
  return precise(a + b);
}

function multiply(a: number, b: number) {
  return precise(a * b);
}

function divide(a: number, b: number) {
  return precise(a / b);
}

function readFactor(tokens: readonly Token[], start: number) {
  const token = tokens[start];
  if (token?.type !== "num") return null;
  let value = token.value;
  let isPercent = false;
  let next = start + 1;
  while (tokens[next]?.type === "pct") {
    value = divide(value, 100);
    isPercent = true;
    next++;
  }
  return { value, isPercent, next };
}

function isMultiplicative(token: Token | undefined): token is { type: "op"; op: "*" | "/" } {
  return token?.type === "op" && (token.op === "*" || token.op === "/");
}

/**
 * Evaluates with precedence. A percentage that is a whole `+` or `−` term is taken of what
 * came before it (`200 + 10%` is 220); anywhere else it is just a fraction (`200 × 10%` is 20).
 * A dangling operator at the end is ignored, so the result stays live while typing.
 * Returns null when there is no number to evaluate.
 */
export function evaluate(tokens: readonly Token[]): Evaluation | null {
  let total: number | null = null;
  let index = 0;
  let sign: 1 | -1 = 1;

  const leading = tokens[0];
  if (leading?.type === "op") {
    if (leading.op === "-") sign = -1;
    index = 1;
  }

  while (index < tokens.length) {
    const first = readFactor(tokens, index);
    if (!first) break;
    index = first.next;

    let term = first.value;
    let isLonePercent = first.isPercent;

    for (let token = tokens[index]; isMultiplicative(token); token = tokens[index]) {
      const factor = readFactor(tokens, index + 1);
      if (!factor) {
        index = tokens.length;
        break;
      }
      if (token.op === "/" && factor.value === 0) return { ok: false, error: "divideByZero" };
      term = token.op === "*" ? multiply(term, factor.value) : divide(term, factor.value);
      isLonePercent = false;
      index = factor.next;
    }

    if (total === null) {
      total = sign * term;
    } else {
      const amount = isLonePercent ? multiply(total, term) : term;
      total = add(total, sign * amount);
    }

    const following = tokens[index];
    if (following?.type !== "op") break;
    sign = following.op === "-" ? -1 : 1;
    index++;
  }

  if (total === null) return null;
  if (!Number.isFinite(total) || Math.abs(total) >= MAX_MAGNITUDE) return { ok: false, error: "tooLarge" };
  return { ok: true, value: Math.abs(total) < 1e-9 ? 0 : total };
}

export type CalculatorState = {
  tokens: Token[];
  /** The number being typed, as typed: "12." must stay "12." until the next key. */
  draft: string;
  /** `=` was just pressed: the only token is the result, and a digit starts over. */
  settled: boolean;
};

export const EMPTY_CALCULATOR: CalculatorState = { tokens: [], draft: "", settled: false };

export type CalculatorAction =
  | { type: "digit"; digit: string }
  | { type: "decimal" }
  | { type: "op"; op: Op }
  | { type: "percent" }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "equals" }
  | { type: "insert"; amount: number; label?: string }
  | { type: "remove"; index: number };

/** The tape as the user sees it: the tokens plus the number still being typed. */
export function liveTokens(state: CalculatorState): Token[] {
  if (!state.draft) return state.tokens;
  return [...state.tokens, { type: "num", value: Number(state.draft), source: "typed" }];
}

export function evaluateState(state: CalculatorState): Evaluation | null {
  const outcome = evaluate(liveTokens(state));
  // "5 ÷ 0" is usually the start of "5 ÷ 0.5": no error until the zero is committed.
  if (outcome && !outcome.ok && outcome.error === "divideByZero" && state.draft && Number(state.draft) === 0) {
    return evaluate(state.tokens);
  }
  return outcome;
}

function startsNewNumber(tokens: Token[]): Token[] {
  const last = tokens.at(-1);
  return last && last.type !== "op" ? [...tokens, { type: "op", op: "+" }] : tokens;
}

function typeDigit(state: CalculatorState, digit: string): CalculatorState {
  if (state.settled) return { tokens: [], draft: digit, settled: false };
  if (!state.draft) return { ...state, tokens: startsNewNumber(state.tokens), draft: digit };
  if (state.draft === "0") return { ...state, draft: digit };
  const [whole, decimals] = state.draft.split(".");
  if (whole.length + (decimals?.length ?? 0) >= MAX_DRAFT_DIGITS) return state;
  if (decimals !== undefined && decimals.length >= MAX_DRAFT_DECIMALS) return state;
  return { ...state, draft: state.draft + digit };
}

function typeDecimal(state: CalculatorState): CalculatorState {
  if (state.settled) return { tokens: [], draft: "0.", settled: false };
  if (!state.draft) return { ...state, tokens: startsNewNumber(state.tokens), draft: "0." };
  if (state.draft.includes(".")) return state;
  return { ...state, draft: `${state.draft}.` };
}

function pressOperator(state: CalculatorState, op: Op): CalculatorState {
  const tokens = liveTokens(state);
  const last = tokens.at(-1);
  if (!last) return op === "-" ? { tokens: [{ type: "op", op }], draft: "", settled: false } : state;
  if (last.type !== "op") return { tokens: [...tokens, { type: "op", op }], draft: "", settled: false };
  // A lone leading operator can only be a minus sign.
  if (tokens.length === 1 && op !== "-") return EMPTY_CALCULATOR;
  return { tokens: [...tokens.slice(0, -1), { type: "op", op }], draft: "", settled: false };
}

function pressBackspace(state: CalculatorState): CalculatorState {
  if (state.settled) return EMPTY_CALCULATOR;
  if (state.draft) return { ...state, draft: state.draft.slice(0, -1) };
  const last = state.tokens.at(-1);
  if (!last) return state;
  const rest = state.tokens.slice(0, -1);
  // Backing into a typed number reopens it for editing; a picked amount goes as a whole.
  if (last.type === "num" && last.source === "typed") {
    return { tokens: rest, draft: String(last.value).slice(0, -1), settled: false };
  }
  return { tokens: rest, draft: "", settled: false };
}

function removeNumber(tokens: Token[], index: number): Token[] {
  if (tokens[index]?.type !== "num") return tokens;
  let start = index;
  let end = index + 1;
  while (tokens[end]?.type === "pct") end++;

  // A factor leaves with its own × or ÷, so `a + b × c` without b is `a + c`, not `a × c`.
  const before = tokens[start - 1];
  const after = tokens[end];
  if (isMultiplicative(before)) start--;
  else if (isMultiplicative(after)) end++;
  else if (before?.type === "op") start--;
  else if (after?.type === "op") end++;

  const remaining = [...tokens.slice(0, start), ...tokens.slice(end)];
  const first = remaining[0];
  return first?.type === "op" && first.op !== "-" ? remaining.slice(1) : remaining;
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case "digit":
      return typeDigit(state, action.digit);
    case "decimal":
      return typeDecimal(state);
    case "op":
      return pressOperator(state, action.op);
    case "percent": {
      const tokens = liveTokens(state);
      if (tokens.at(-1)?.type !== "num") return state;
      return { tokens: [...tokens, { type: "pct" }], draft: "", settled: false };
    }
    case "backspace":
      return pressBackspace(state);
    case "clear":
      return EMPTY_CALCULATOR;
    case "equals": {
      const tokens = liveTokens(state);
      const outcome = evaluate(tokens);
      if (!outcome) return state;
      if (!outcome.ok) return { tokens, draft: "", settled: false };
      if (tokens.length === 1) return { tokens, draft: "", settled: true };
      return { tokens: [{ type: "num", value: outcome.value, source: "result" }], draft: "", settled: true };
    }
    case "insert": {
      const tokens = startsNewNumber(liveTokens(state));
      const token: Token = { type: "num", value: precise(action.amount), source: "picked" };
      if (action.label) token.label = action.label;
      return { tokens: [...tokens, token], draft: "", settled: false };
    }
    case "remove":
      return { tokens: removeNumber(liveTokens(state), action.index), draft: "", settled: false };
  }
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Maps a keyboard key to an action. Enter and `c` depend on focus, so the caller handles those. */
export function keyToAction(key: string): CalculatorAction | null {
  if (key >= "0" && key <= "9" && key.length === 1) return { type: "digit", digit: key };
  const arabicDigit = key.length === 1 ? ARABIC_DIGITS.indexOf(key) : -1;
  if (arabicDigit !== -1) return { type: "digit", digit: String(arabicDigit) };
  switch (key) {
    case ".":
    case ",":
    case "٫":
      return { type: "decimal" };
    case "+":
      return { type: "op", op: "+" };
    case "-":
    case "−":
      return { type: "op", op: "-" };
    case "*":
    case "×":
    case "x":
    case "X":
      return { type: "op", op: "*" };
    case "/":
    case "÷":
      return { type: "op", op: "/" };
    case "%":
    case "٪":
      return { type: "percent" };
    case "Backspace":
      return { type: "backspace" };
    case "Delete":
      return { type: "clear" };
    default:
      return null;
  }
}

export type FreeMoneyInsight =
  | { kind: "leaves"; amount: number }
  | { kind: "over"; amount: number }
  | { kind: "none" };

export type Insight = { percentOfBalance: number | null; free: FreeMoneyInsight | null };

/** What a positive result means against the user's money. Null when there is nothing to say. */
export function insightFor(
  result: number | null,
  position: { balance?: number; freeToSpend?: number },
): Insight | null {
  if (result === null || result <= 0) return null;
  const { balance, freeToSpend } = position;

  const percent = balance !== undefined && balance > 0 ? Math.round((result / balance) * 100) : 0;
  let free: FreeMoneyInsight | null = null;
  if (freeToSpend !== undefined) {
    if (freeToSpend <= 0) free = { kind: "none" };
    else if (result > freeToSpend) free = { kind: "over", amount: subtractMoney(result, freeToSpend) };
    else free = { kind: "leaves", amount: subtractMoney(freeToSpend, result) };
  }

  if (percent === 0 && !free) return null;
  return { percentOfBalance: percent === 0 ? null : percent, free };
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { round2 } from "../utils";
import {
  calculatorReducer,
  EMPTY_CALCULATOR,
  evaluate,
  evaluateState,
  insightFor,
  keyToAction,
  liveTokens,
  type CalculatorAction,
  type CalculatorState,
  type Op,
  type Token,
} from "./engine";

const n = (value: number): Token => ({ type: "num", value });
const o = (op: Op): Token => ({ type: "op", op });
const pct: Token = { type: "pct" };

function value(tokens: Token[]) {
  const outcome = evaluate(tokens);
  assert.ok(outcome?.ok, `expected a value, got ${JSON.stringify(outcome)}`);
  return outcome.value;
}

function run(...actions: CalculatorAction[]): CalculatorState {
  return actions.reduce(calculatorReducer, EMPTY_CALCULATOR);
}

function keys(sequence: string, from: CalculatorState = EMPTY_CALCULATOR): CalculatorState {
  return [...sequence].reduce((state, key) => {
    const action = key === "=" ? ({ type: "equals" } as const) : keyToAction(key);
    assert.ok(action, `no action for ${key}`);
    return calculatorReducer(state, action);
  }, from);
}

function shown(state: CalculatorState) {
  const outcome = evaluateState(state);
  return outcome?.ok ? outcome.value : outcome;
}

test("empty tape has no result", () => {
  assert.equal(evaluate([]), null);
  assert.equal(evaluate([o("-")]), null);
  assert.equal(evaluateState(EMPTY_CALCULATOR), null);
});

test("× and ÷ bind tighter than + and −", () => {
  assert.equal(value([n(2), o("+"), n(3), o("*"), n(4)]), 14);
  assert.equal(value([n(20), o("-"), n(10), o("/"), n(4)]), 17.5);
  assert.equal(value([n(2), o("*"), n(3), o("+"), n(4), o("*"), n(5)]), 26);
});

test("+ and − are exact in cents", () => {
  assert.equal(value([n(0.1), o("+"), n(0.2)]), 0.3);
  assert.equal(value([n(1.1), o("+"), n(2.2), o("-"), n(3.3)]), 0);
  assert.equal(value([n(1234567.89), o("+"), n(0.01)]), 1234567.9);
  assert.equal(value([n(19.99), o("*"), n(3)]), 59.97);
});

test("a percentage term is taken of what came before it", () => {
  assert.equal(value([n(200), o("+"), n(10), pct]), 220);
  assert.equal(value([n(200), o("-"), n(25), pct]), 150);
  assert.equal(value([n(100), o("+"), n(50), o("+"), n(10), pct]), 165);
  assert.equal(value([n(100), o("+"), n(10), pct, o("+"), n(10), pct]), 121);
});

test("elsewhere a percentage is a fraction", () => {
  assert.equal(value([n(200), o("*"), n(10), pct]), 20);
  assert.equal(value([n(200), o("/"), n(10), pct]), 2000);
  assert.equal(value([n(10), pct]), 0.1);
  assert.equal(value([n(10), pct, o("*"), n(200)]), 20);
  assert.equal(value([n(7), pct, o("*"), n(100)]), 7);
  assert.equal(value([n(100), o("+"), n(50), o("*"), n(10), pct]), 105);
});

test("division by zero is an error state, not Infinity", () => {
  assert.deepEqual(evaluate([n(5), o("/"), n(0)]), { ok: false, error: "divideByZero" });
  assert.deepEqual(evaluate([n(0), o("/"), n(0)]), { ok: false, error: "divideByZero" });
  assert.deepEqual(evaluate([n(5), o("/"), n(0), pct]), { ok: false, error: "divideByZero" });
  assert.deepEqual(evaluate([n(1), o("+"), n(5), o("/"), n(0)]), { ok: false, error: "divideByZero" });
});

test("numbers too large to hold every cent are an error", () => {
  assert.deepEqual(evaluate([n(1e14), o("*"), n(10)]), { ok: false, error: "tooLarge" });
  assert.deepEqual(evaluate([n(1e308), o("*"), n(1e308)]), { ok: false, error: "tooLarge" });
});

test("a dangling operator is ignored", () => {
  assert.equal(value([n(5), o("+")]), 5);
  assert.equal(value([n(5), o("/")]), 5);
  assert.equal(value([n(2), o("+"), n(5), o("*")]), 7);
});

test("a leading minus negates the first term", () => {
  assert.equal(value([o("-"), n(5)]), -5);
  assert.equal(value([o("-"), n(5), o("+"), n(8)]), 3);
  assert.equal(value([o("-"), n(2), o("*"), n(3)]), -6);
});

test("the result is never negative zero", () => {
  assert.ok(Object.is(value([n(5), o("-"), n(5)]), 0));
  assert.ok(Object.is(value([o("-"), n(0)]), 0));
});

test("typing keeps the raw text and the live result", () => {
  const state = keys("12.");
  assert.equal(state.draft, "12.");
  assert.equal(shown(state), 12);
  assert.equal(keys(".5").draft, "0.5");
  assert.equal(keys("007").draft, "7");
  assert.equal(keys("1.2.3").draft, "1.23");
});

test("typing stops at the digit limits", () => {
  assert.equal(keys("1234567890123456789").draft, "123456789012345");
  assert.equal(keys("0.123456789").draft, "0.123456");
  assert.deepEqual(shown(keys("999999999999999+1")), { ok: false, error: "tooLarge" });
});

test("keys evaluate with precedence", () => {
  assert.equal(shown(keys("2+3*4")), 14);
  assert.equal(shown(keys("200+10%")), 220);
  assert.equal(shown(keys("200*10%")), 20);
});

test("a second operator replaces the first", () => {
  const state = keys("5+*");
  assert.deepEqual(state.tokens.at(-1), o("*"));
  assert.equal(state.tokens.length, 2);
});

test("only minus can start a tape", () => {
  assert.deepEqual(keys("+").tokens, []);
  assert.deepEqual(keys("*").tokens, []);
  assert.deepEqual(keys("%").tokens, []);
  assert.deepEqual(keys("-").tokens, [o("-")]);
  assert.deepEqual(keys("-+").tokens, []);
  assert.equal(shown(keys("-5+8")), 3);
});

test("% only follows a number, and only once", () => {
  assert.equal(keys("5+%").tokens.at(-1)?.type, "op");
  assert.equal(keys("5%%").tokens.filter((token) => token.type === "pct").length, 1);
});

test("= on a single typed number settles it, so the next digit starts over", () => {
  const state = keys("5=");
  assert.equal(state.settled, true);
  assert.equal(keys("3", state).draft, "3");
  assert.deepEqual(keys("3", state).tokens, []);
  assert.equal(shown(keys("+3", state)), 8);
});

test("= collapses the tape into the result", () => {
  const state = keys("2+3=");
  assert.deepEqual(state.tokens, [{ type: "num", value: 5, source: "result" }]);
  assert.equal(state.settled, true);
  assert.deepEqual(calculatorReducer(state, { type: "equals" }), state);
});

test("after =, a digit starts over and an operator continues", () => {
  assert.equal(shown(keys("9", keys("2+3="))), 9);
  assert.equal(keys("9", keys("2+3=")).tokens.length, 0);
  assert.equal(shown(keys("*2", keys("2+3="))), 10);
  assert.equal(shown(keys(".5", keys("2+3="))), 0.5);
});

test("= keeps the fraction of a cent for the next step", () => {
  assert.equal(round2(shown(keys("*3", keys("10/3="))) as number), 10);
  assert.equal(shown(keys("*3", keys("10/3+1="))), 13);
});

test("= on a division by zero shows the error and keeps the tape", () => {
  const state = keys("5/0=");
  assert.equal(state.settled, false);
  assert.equal(state.tokens.length, 3);
  assert.deepEqual(shown(state), { ok: false, error: "divideByZero" });
});

test("a typed zero after ÷ is not an error until it is committed", () => {
  assert.equal(shown(keys("5/0")), 5);
  assert.equal(shown(keys("5/0.")), 5);
  assert.equal(shown(keys("5/0.5")), 10);
  assert.deepEqual(shown(keys("5/0+")), { ok: false, error: "divideByZero" });
});

test("inserting adds + after a number and keeps the exact amount and label", () => {
  const state = run({ type: "insert", amount: 1234.56, label: "Rent" }, { type: "insert", amount: 30 });
  assert.deepEqual(state.tokens, [
    { type: "num", value: 1234.56, source: "picked", label: "Rent" },
    { type: "op", op: "+" },
    { type: "num", value: 30, source: "picked" },
  ]);
  assert.equal(shown(state), 1264.56);
});

test("inserting respects the operator already there", () => {
  const state = calculatorReducer(keys("100-"), { type: "insert", amount: 30 });
  assert.equal(shown(state), 70);
  assert.equal(state.tokens.length, 3);
});

test("inserting commits a number being typed", () => {
  const state = calculatorReducer(keys("12"), { type: "insert", amount: 8 });
  assert.equal(state.draft, "");
  assert.equal(shown(state), 20);
});

test("inserting after % or = continues with +", () => {
  assert.equal(shown(calculatorReducer(keys("200+10%"), { type: "insert", amount: 5 })), 225);
  assert.equal(shown(calculatorReducer(keys("2+3="), { type: "insert", amount: 5 })), 10);
});

test("a net amount keeps its sign", () => {
  assert.equal(shown(run({ type: "insert", amount: 100 }, { type: "insert", amount: -30 })), 70);
});

test("inserting drops float noise from the amount", () => {
  assert.deepEqual(run({ type: "insert", amount: 0.1 + 0.2 }).tokens[0], { type: "num", value: 0.3, source: "picked" });
});

test("digits after a picked amount start a new number with +", () => {
  const state = keys("5", run({ type: "insert", amount: 100 }));
  assert.equal(state.draft, "5");
  assert.deepEqual(state.tokens.at(-1), o("+"));
  assert.equal(shown(state), 105);
});

test("backspace edits a draft, then walks back through the tape", () => {
  let state = keys("12+34");
  state = calculatorReducer(state, { type: "backspace" });
  assert.equal(state.draft, "3");
  state = calculatorReducer(state, { type: "backspace" });
  assert.equal(state.draft, "");
  state = calculatorReducer(state, { type: "backspace" });
  assert.deepEqual(state.tokens.map((token) => token.type), ["num"]);
  state = calculatorReducer(state, { type: "backspace" });
  assert.equal(state.draft, "1");
  assert.deepEqual(state.tokens, []);
  state = calculatorReducer(state, { type: "backspace" });
  assert.deepEqual(state, EMPTY_CALCULATOR);
  assert.deepEqual(calculatorReducer(state, { type: "backspace" }), EMPTY_CALCULATOR);
});

test("backspace removes a picked amount as a whole", () => {
  const state = calculatorReducer(run({ type: "insert", amount: 100, label: "Rent" }), { type: "backspace" });
  assert.deepEqual(state.tokens, []);
  assert.equal(state.draft, "");
});

test("backspace clears a settled result", () => {
  assert.deepEqual(calculatorReducer(keys("2+3="), { type: "backspace" }), EMPTY_CALCULATOR);
});

test("removing a chip takes its operator with it", () => {
  const base = run({ type: "insert", amount: 10 }, { type: "insert", amount: 20 }, { type: "insert", amount: 30 });
  assert.equal(shown(calculatorReducer(base, { type: "remove", index: 0 })), 50);
  assert.equal(shown(calculatorReducer(base, { type: "remove", index: 2 })), 40);
  assert.equal(shown(calculatorReducer(base, { type: "remove", index: 4 })), 30);
  assert.equal(calculatorReducer(base, { type: "remove", index: 0 }).tokens[0].type, "num");
});

test("removing a factor keeps the sums around it", () => {
  assert.equal(shown(calculatorReducer(keys("100+2*3"), { type: "remove", index: 2 })), 103);
  assert.equal(shown(calculatorReducer(keys("100+2*3"), { type: "remove", index: 4 })), 102);
  assert.equal(shown(calculatorReducer(keys("8*2/4"), { type: "remove", index: 2 })), 2);
  assert.equal(shown(calculatorReducer(keys("8/2*4"), { type: "remove", index: 2 })), 32);
});

test("removing the first term keeps a leading minus valid", () => {
  assert.deepEqual(calculatorReducer(keys("-5+8"), { type: "remove", index: 1 }).draft, "");
  assert.equal(shown(calculatorReducer(keys("-5+8"), { type: "remove", index: 1 })), 8);
  assert.equal(shown(calculatorReducer(keys("-5*8"), { type: "remove", index: 1 })), -8);
});

test("removing a chip takes its percent with it", () => {
  assert.equal(shown(calculatorReducer(keys("200+10%"), { type: "remove", index: 2 })), 200);
});

test("removing the first number of a product keeps the rest valid", () => {
  const state = calculatorReducer(keys("3*4+5"), { type: "remove", index: 0 });
  assert.equal(shown(state), 9);
});

test("removing the number being typed", () => {
  const typed = keys("12+34");
  const state = calculatorReducer(typed, { type: "remove", index: liveTokens(typed).length - 1 });
  assert.equal(state.draft, "");
  assert.equal(shown(state), 12);
});

test("removing an operator index does nothing", () => {
  const state = keys("12+34");
  assert.equal(shown(calculatorReducer(state, { type: "remove", index: 1 })), 46);
});

test("clear resets everything", () => {
  assert.deepEqual(calculatorReducer(keys("2+3"), { type: "clear" }), EMPTY_CALCULATOR);
});

test("the keyboard accepts Arabic digits and every decimal separator", () => {
  assert.equal(keys("١٢٫٥").draft, "12.5");
  assert.equal(keys("٠٧").draft, "7");
  assert.equal(keys("1,5").draft, "1.5");
  assert.equal(keys("1.5").draft, "1.5");
});

test("the keyboard accepts every operator spelling", () => {
  assert.deepEqual(keyToAction("−"), { type: "op", op: "-" });
  assert.deepEqual(keyToAction("-"), { type: "op", op: "-" });
  assert.deepEqual(keyToAction("×"), { type: "op", op: "*" });
  assert.deepEqual(keyToAction("x"), { type: "op", op: "*" });
  assert.deepEqual(keyToAction("÷"), { type: "op", op: "/" });
  assert.deepEqual(keyToAction("/"), { type: "op", op: "/" });
  assert.deepEqual(keyToAction("٪"), { type: "percent" });
  assert.equal(keyToAction("a"), null);
  assert.equal(keyToAction("Enter"), null);
  assert.equal(keyToAction("F1"), null);
  assert.equal(keyToAction("10"), null);
});

test("insight compares the result with the balance and free money", () => {
  assert.deepEqual(insightFor(310, { balance: 1000, freeToSpend: 1550 }), {
    percentOfBalance: 31,
    free: { kind: "leaves", amount: 1240 },
  });
  assert.deepEqual(insightFor(600.1, { balance: 2000, freeToSpend: 510.1 }), {
    percentOfBalance: 30,
    free: { kind: "over", amount: 90 },
  });
  assert.deepEqual(insightFor(50, { balance: 1000, freeToSpend: 0 }), {
    percentOfBalance: 5,
    free: { kind: "none" },
  });
  assert.deepEqual(insightFor(50, { balance: 1000, freeToSpend: -20 }), {
    percentOfBalance: 5,
    free: { kind: "none" },
  });
  assert.deepEqual(insightFor(50, { balance: 50, freeToSpend: 50 }), {
    percentOfBalance: 100,
    free: { kind: "leaves", amount: 0 },
  });
});

test("insight says nothing without a positive result or any figures", () => {
  assert.equal(insightFor(null, { balance: 100, freeToSpend: 100 }), null);
  assert.equal(insightFor(0, { balance: 100, freeToSpend: 100 }), null);
  assert.equal(insightFor(-5, { balance: 100, freeToSpend: 100 }), null);
  assert.equal(insightFor(5, {}), null);
  assert.equal(insightFor(5, { balance: 0 }), null);
  assert.deepEqual(insightFor(5, { balance: 0, freeToSpend: 10 }), {
    percentOfBalance: null,
    free: { kind: "leaves", amount: 5 },
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "./format";
import { round2 } from "./utils";

describe("formatMoney", () => {
  it("puts a sign in front of left-to-right amounts", () => {
    assert.equal(formatMoney(-1240, "USD", "en-US"), "−$1,240");
    assert.equal(formatMoney(1240, "USD", "en-US", { signed: true }), "+$1,240");
  });

  it("keeps the sign next to the number in right-to-left formats", () => {
    const negative = formatMoney(-1240, "MAD", "ar-MA");
    assert.ok(negative.startsWith("‏−"), JSON.stringify(negative));
    const positive = formatMoney(1240, "MAD", "ar-MA", { signed: true });
    assert.ok(positive.startsWith("‏+"), JSON.stringify(positive));
  });
});

describe("round2", () => {
  it("rounds half cents up despite float error", () => {
    assert.equal(round2(1.15 / 2), 0.58);
    assert.equal(round2(4.35 / 2), 2.18);
    assert.equal(round2(2.01 / 2), 1.01);
    assert.equal(round2(8.15 / 2), 4.08);
  });

  it("leaves whole cents alone", () => {
    assert.equal(round2(999999999.99), 999999999.99);
    assert.equal(round2(0.1 + 0.2), 0.3);
    assert.equal(round2(-12.34), -12.34);
  });
});

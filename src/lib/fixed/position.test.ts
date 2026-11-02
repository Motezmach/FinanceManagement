import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateFunding,
  buildObligations,
  computePosition,
  isoDay,
  nextAutoPayment,
  pickForSavings,
  savingsProgress,
  savingsShortBy,
  type ObligationSource,
  type StatusTotal,
} from "./position";

const totals = (rows: Partial<Record<string, number>>): StatusTotal[] =>
  Object.entries(rows).map(([key, total]) => {
    const [kind, status] = key.split(":") as [StatusTotal["kind"], StatusTotal["status"]];
    return { kind, status, total: total ?? 0 };
  });

describe("computePosition", () => {
  it("keeps saved money in the balance and out of free to spend", () => {
    const position = computePosition(
      totals({ "debit:settled": 3000, "credit:settled": 500, "credit:saved": 800, "credit:pending": 200 }),
    );
    assert.equal(position.balance, 2500);
    assert.equal(position.billsSaved, 800);
    assert.equal(position.dueOut, 200);
    assert.equal(position.freeToSpend, 1500);
    assert.equal(position.shortfall, 0);
  });

  it("does not move free to spend on Savings, on Paid or on an auto-pay", () => {
    const due = computePosition(totals({ "debit:settled": 1000, "credit:pending": 300 }));
    const saved = computePosition(totals({ "debit:settled": 1000, "credit:saved": 300 }));
    const paid = computePosition(totals({ "debit:settled": 1000, "credit:settled": 300 }));
    assert.equal(due.freeToSpend, 700);
    assert.equal(saved.freeToSpend, 700);
    assert.equal(paid.freeToSpend, 700);
    assert.equal(saved.balance, 1000);
    assert.equal(paid.balance, 700);
  });

  it("does not subtract planned spending", () => {
    const position = computePosition(totals({ "debit:settled": 100, "credit:planned": 90 }));
    assert.equal(position.plannedOut, 90);
    assert.equal(position.freeToSpend, 100);
  });

  it("reports a shortfall when bills exceed the money", () => {
    const position = computePosition(totals({ "debit:settled": 100, "credit:pending": 330.5 }));
    assert.equal(position.freeToSpend, -230.5);
    assert.equal(position.shortfall, 230.5);
  });

  it("computes in cents, so float noise never becomes money", () => {
    const position = computePosition(totals({ "debit:settled": 0.3, "credit:settled": 0.1, "credit:pending": 0.2 }));
    assert.equal(position.balance, 0.2);
    assert.equal(position.freeToSpend, 0);
    assert.equal(position.shortfall, 0);
    assert.ok(Object.is(position.freeToSpend, 0), "no negative zero");
  });

  it("is all zeros with no entries", () => {
    const position = computePosition([]);
    assert.deepEqual(Object.values(position), [0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("allocateFunding", () => {
  const bill = (id: string, amount: number, renewal: string) => ({ id, amount, renewsOn: renewal });

  it("funds in renewal order, whatever order the rows arrive in", () => {
    const funded = allocateFunding(500, [bill("late", 300, "2026-12-20"), bill("soon", 300, "2026-12-01")]);
    assert.deepEqual([...funded], ["soon"]);
  });

  it("funds a bill the balance covers exactly", () => {
    assert.deepEqual([...allocateFunding(300, [bill("a", 300, "2026-12-01")])], ["a"]);
    assert.deepEqual([...allocateFunding(299.99, [bill("a", 300, "2026-12-01")])], []);
  });

  it("stops at the first bill it cannot cover, even if a later one is smaller", () => {
    const funded = allocateFunding(100, [bill("big", 150, "2026-12-01"), bill("small", 50, "2026-12-02")]);
    assert.deepEqual([...funded], []);
  });

  it("funds nothing from a negative balance", () => {
    assert.equal(allocateFunding(-5, [bill("a", 1, "2026-12-01")]).size, 0);
  });

  it("adds in cents", () => {
    const funded = allocateFunding(0.3, [bill("a", 0.1, "2026-12-01"), bill("b", 0.2, "2026-12-02")]);
    assert.deepEqual([...funded], ["a", "b"]);
  });

  it("does not reorder its input", () => {
    const rows = [bill("b", 1, "2026-12-02"), bill("a", 1, "2026-12-01")];
    allocateFunding(10, rows);
    assert.deepEqual(rows.map((row) => row.id), ["b", "a"]);
  });
});

describe("savingsShortBy", () => {
  it("is what the savings exceed the balance by", () => {
    assert.equal(savingsShortBy({ balance: 100, billsSaved: 800 }), 700);
    assert.equal(savingsShortBy({ balance: 800, billsSaved: 800 }), 0);
    assert.equal(savingsShortBy({ balance: 900, billsSaved: 800 }), 0);
  });

  it("counts what is about to go in savings", () => {
    assert.equal(savingsShortBy({ balance: 100, billsSaved: 50 }, 100.1), 50.1);
  });
});

describe("savingsProgress", () => {
  it("counts down from the day it went in savings to renewal", () => {
    assert.equal(savingsProgress("2026-11-01", "2026-11-11", "2026-11-01"), 0);
    assert.equal(savingsProgress("2026-11-01", "2026-11-11", "2026-11-06"), 0.5);
    assert.equal(savingsProgress("2026-11-01", "2026-11-11", "2026-11-11"), 1);
  });

  it("is 0 without a saved date, and clamped either way", () => {
    assert.equal(savingsProgress(null, "2026-11-11", "2026-11-06"), 0);
    assert.equal(savingsProgress("2026-11-01", "2026-11-11", "2026-10-20"), 0);
    assert.equal(savingsProgress("2026-11-01", "2026-11-11", "2026-12-20"), 1);
  });

  it("does not divide by zero when saved on the renewal day", () => {
    assert.equal(savingsProgress("2026-11-11", "2026-11-11", "2026-11-11"), 1);
    assert.equal(savingsProgress("2026-11-12", "2026-11-11", "2026-11-12"), 1);
  });
});

describe("isoDay", () => {
  it("reads the UTC day, whatever the server's zone", () => {
    assert.equal(isoDay(new Date("2026-11-05T00:00:00Z")), "2026-11-05");
    assert.equal(isoDay(new Date("2026-11-05T23:59:59Z")), "2026-11-05");
  });
});

function source(id: string, overrides: Partial<ObligationSource> = {}): ObligationSource {
  return {
    id,
    title: id,
    amount: 100,
    date: "2026-11-05",
    status: "pending",
    bucket: "fixed",
    ruleId: `rule-${id}`,
    period: "2026-11",
    autoPayHold: false,
    category: null,
    rule: { dayOfMonth: 5, autoPay: false, isActive: true },
    ...overrides,
  };
}

const oneOff = { ruleId: null, period: null, rule: null };

describe("buildObligations", () => {
  const today = "2026-11-10";

  it("leaves out settled records", () => {
    assert.deepEqual(buildObligations([source("paid", { status: "settled" })], today), []);
  });

  it("puts late bills first, then the rest by date", () => {
    const list = buildObligations(
      [
        source("soon", { date: "2026-11-12", period: "2026-11", rule: { dayOfMonth: 12, autoPay: false, isActive: true } }),
        source("late", { date: "2026-10-05", period: "2026-10" }),
        source("today", { date: "2026-11-10", rule: { dayOfMonth: 10, autoPay: false, isActive: true } }),
        source("oneoff", { ...oneOff, date: "2026-11-01", bucket: "daily" }),
      ],
      today,
    );
    assert.deepEqual(list.map((item) => item.id), ["late", "oneoff", "today", "soon"]);
    assert.deepEqual(list.map((item) => item.phase), ["late", null, "today", "upcoming"]);
  });

  it("gives a one-off entry no cycle", () => {
    const [item] = buildObligations([source("x", { ...oneOff, bucket: "optional", status: "planned" })], today);
    assert.equal(item.renewsOn, null);
    assert.equal(item.phase, null);
    assert.equal(item.willAutoPay, false);
    assert.equal(item.canSave, false);
  });

  it("offers Savings only on a running Due bill", () => {
    const canSave = (overrides: Partial<ObligationSource>) => buildObligations([source("x", overrides)], today)[0].canSave;
    assert.equal(canSave({}), true);
    assert.equal(canSave({ status: "saved" }), false);
    assert.equal(canSave({ period: "2026-10", date: "2026-10-05" }), false);
  });

  it("offers Savings on no other record of a rule that already has one in savings", () => {
    const list = buildObligations(
      [
        source("saved", { ruleId: "r", status: "saved", period: "2026-11" }),
        source("next", { ruleId: "r", period: "2026-12", date: "2026-12-05" }),
        source("other", { ruleId: "s" }),
      ],
      today,
    );
    assert.deepEqual(list.filter((item) => item.canSave).map((item) => item.id), ["other"]);
  });

  it("knows what pays by itself", () => {
    const pays = (overrides: Partial<ObligationSource>) => buildObligations([source("x", overrides)], today)[0].willAutoPay;
    const rule = (autoPay: boolean, isActive = true) => ({ dayOfMonth: 5, autoPay, isActive });
    assert.equal(pays({ status: "saved" }), true);
    assert.equal(pays({ status: "saved", rule: rule(false, false) }), true);
    assert.equal(pays({ rule: rule(false) }), false);
    assert.equal(pays({ rule: rule(true) }), true);
    assert.equal(pays({ rule: rule(true), autoPayHold: true }), false);
    assert.equal(pays({ rule: rule(true, false) }), false, "a paused rule pays no Due bill");
  });
});

describe("pickForSavings", () => {
  const item = (ruleId: string | null, period: string, canSave = true) => ({ ruleId, period, canSave });

  it("takes everything that can be saved", () => {
    const picks = pickForSavings([item("a", "2026-11"), item("b", "2026-11"), item("c", "2026-11", false)]);
    assert.deepEqual(picks.map((pick) => pick.ruleId), ["a", "b"]);
  });

  it("takes only the oldest running record of a rule", () => {
    const picks = pickForSavings([item("a", "2026-11"), item("a", "2026-10")]);
    assert.deepEqual(picks.map((pick) => pick.period), ["2026-10"]);
  });

  it("ignores a record without a rule", () => {
    assert.deepEqual(pickForSavings([item(null, "2026-11")]), []);
  });

  it("is exactly what Not in savings yet lists, so the two sums agree", () => {
    const list = buildObligations(
      [
        source("a", { ruleId: "r", period: "2026-10", date: "2026-10-15", amount: 10, rule: { dayOfMonth: 15, autoPay: false, isActive: true } }),
        source("b", { ruleId: "r", period: "2026-11", date: "2026-11-15", amount: 20, rule: { dayOfMonth: 15, autoPay: false, isActive: true } }),
        source("c", { ruleId: "s", period: "2026-11", date: "2026-11-15", amount: 40, rule: { dayOfMonth: 15, autoPay: false, isActive: true } }),
        source("d", { ruleId: "t", period: "2026-09", date: "2026-09-05", amount: 80 }),
        source("e", { ...oneOff, amount: 160 }),
      ],
      "2026-11-10",
    );
    assert.deepEqual(pickForSavings(list).map((pick) => pick.id).sort(), ["a", "c"]);
  });
});

describe("nextAutoPayment", () => {
  const today = "2026-11-10";

  it("is null when nothing pays by itself", () => {
    assert.equal(nextAutoPayment(buildObligations([source("x")], today)), null);
    assert.equal(nextAutoPayment([]), null);
  });

  it("sums what pays on the earliest renewal, in cents", () => {
    const next = nextAutoPayment(
      buildObligations(
        [
          source("a", { status: "saved", amount: 0.1 }),
          source("b", { status: "saved", amount: 0.2 }),
          source("c", { status: "saved", period: "2026-12", date: "2026-12-05" }),
          source("d", { amount: 1000 }),
        ],
        today,
      ),
    );
    assert.deepEqual(next, { date: "2026-12-05", amount: 0.3, count: 2 });
  });
});

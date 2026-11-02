import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Category, Entry, RecurringRule } from "../db/schema";
import type { EntryWithCategory } from "../queries/entries";
import { buildFixedBoard, scheduledBills, type FixedRow, type FixedState } from "./board";
import type { Position } from "./position";

const STAMP = new Date("2026-01-01T00:00:00Z");
const TODAY = "2026-11-10";

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: "rule",
    userId: "user",
    categoryId: "cat",
    title: "Rent",
    amount: 800,
    dayOfMonth: 5,
    note: null,
    isActive: true,
    startsOn: "2026-01-05",
    endsOn: null,
    autoPay: false,
    source: "user",
    createdAt: STAMP,
    ...overrides,
  };
}

function record(period: string, status: Entry["status"], overrides: Partial<Entry> = {}): Entry {
  return {
    id: `${overrides.ruleId ?? "rule"}:${period}`,
    userId: "user",
    categoryId: "cat",
    kind: "credit",
    bucket: "fixed",
    status,
    amount: 800,
    title: "Rent",
    note: null,
    date: `${period}-05`,
    ruleId: "rule",
    period,
    savedAt: null,
    settledAt: null,
    autoPaid: false,
    autoPaidSeen: false,
    autoPayHold: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

const category: Category = {
  id: "cat",
  userId: "user",
  kind: "credit",
  name: "Home",
  color: "stone",
  icon: "home",
  sortOrder: 0,
  isArchived: false,
  createdAt: STAMP,
};

function position(balance = 100_000, billsSaved = 0): Position {
  return { balance, billsSaved, dueOut: 0, plannedOut: 0, pendingIn: 0, potentialIn: 0, freeToSpend: 0, shortfall: 0 };
}

function state(overrides: Partial<FixedState> = {}): FixedState {
  return { rules: [rule()], records: [], skips: [], categories: [category], position: position(), ...overrides };
}

function board(overrides: Partial<FixedState> = {}, period = "2026-11", today = TODAY, history: EntryWithCategory[] = []) {
  return buildFixedBoard(state(overrides), history, period, today);
}

const only = (rows: FixedRow[]) => {
  assert.equal(rows.length, 1);
  return rows[0];
};

describe("the current month", () => {
  it("shows a running Due bill with Savings and Paid", () => {
    const row = only(board({ records: [record("2026-11", "pending")] }).rows);
    assert.equal(row.state, "due");
    assert.equal(row.phase, "open");
    assert.equal(row.instancePeriod, "2026-11");
    assert.equal(row.dueDate, "2026-11-05");
    assert.equal(row.renewsOn, "2026-12-05");
    assert.equal(row.nextDate, "2026-12-05");
    assert.deepEqual([row.canAct, row.canSave, row.canSkip, row.canManageRule], [true, true, true, true]);
    assert.equal(row.willAutoPay, false);
  });

  it("puts a bill whose month ended in Late, with no Savings", () => {
    const result = board({ records: [record("2026-10", "pending"), record("2026-11", "pending")] });
    const late = only(result.late);
    assert.equal(late.instancePeriod, "2026-10");
    assert.equal(late.phase, "late");
    assert.equal(late.canSave, false);
    assert.equal(late.canAct, true);
    assert.equal(late.canSkip, true);
    assert.equal(only(result.rows).instancePeriod, "2026-11");
  });

  it("shows last month's bill in the first days of its cycle", () => {
    const row = only(board({ records: [record("2026-10", "pending")] }, "2026-11", "2026-11-03").rows);
    assert.equal(row.instancePeriod, "2026-10");
    assert.equal(row.phase, "open");
    assert.equal(row.renewsOn, "2026-11-05");
    assert.equal(row.nextDate, "2026-11-05");
    assert.equal(row.canSave, true);
  });

  it("shows two rows when two months are running", () => {
    const records = [record("2026-10", "pending"), record("2026-11", "pending", { date: "2026-11-05" })];
    const rows = board({ records }, "2026-11", "2026-11-03").rows;
    assert.deepEqual(rows.map((row) => row.instancePeriod), ["2026-10", "2026-11"]);
    assert.equal(new Set(rows.map((row) => row.key)).size, 2);
  });

  it("shows this month's paid record with the next date", () => {
    const row = only(board({ records: [record("2026-11", "settled")] }).rows);
    assert.equal(row.state, "paid");
    assert.equal(row.phase, null);
    assert.equal(row.renewsOn, null);
    assert.equal(row.nextDate, "2026-12-05");
    assert.deepEqual([row.canAct, row.canSave, row.canSkip], [false, false, false]);
  });

  it("a bill paid ahead of its date is next due the month after", () => {
    const row = only(board({ records: [record("2026-11", "settled")] }, "2026-11", "2026-11-02").rows);
    assert.equal(row.nextDate, "2026-12-05");
  });

  it("tells paid from paid automatically", () => {
    const row = only(board({ records: [record("2026-11", "settled", { autoPaid: true })] }).rows);
    assert.equal(row.state, "autopaid");
  });

  it("shows a paid record beside a late one of the same rule", () => {
    const result = board({ records: [record("2026-10", "pending"), record("2026-11", "settled")] });
    assert.equal(only(result.late).instancePeriod, "2026-10");
    assert.equal(only(result.rows).state, "paid");
  });

  it("with no record this month, falls back to the latest paid one", () => {
    const records = [record("2026-08", "settled"), record("2026-09", "settled")];
    const row = only(board({ records }).rows);
    assert.equal(row.state, "paid");
    assert.equal(row.instancePeriod, "2026-09");
    assert.equal(row.nextDate, "2026-12-05");
  });

  it("shows a skipped month", () => {
    const result = board({ records: [record("2026-10", "settled")], skips: [{ ruleId: "rule", period: "2026-11" }] });
    const row = only(result.rows);
    assert.equal(row.state, "skipped");
    assert.equal(row.instancePeriod, "2026-11");
    assert.equal(row.instance, null);
    assert.equal(row.canAct, false);
  });

  it("keeps a skipped month reachable beside last month's running bill", () => {
    const rows = board(
      { records: [record("2026-10", "pending")], skips: [{ ruleId: "rule", period: "2026-11" }] },
      "2026-11",
      "2026-11-03",
    ).rows;
    assert.deepEqual(rows.map((row) => row.state), ["due", "skipped"]);
  });

  it("shows a paused rule with nothing running", () => {
    const row = only(board({ rules: [rule({ isActive: false })] }).rows);
    assert.equal(row.state, "paused");
    assert.equal(row.canManageRule, true);
    assert.equal(row.nextDate, null);
  });

  it("a paused rule keeps its late bill in Late and stays resumable", () => {
    const result = board({ rules: [rule({ isActive: false })], records: [record("2026-09", "pending")] });
    assert.equal(only(result.late).instancePeriod, "2026-09");
    assert.equal(only(result.rows).state, "paused");
  });

  it("a paused rule still shows what is running and pays only saved money", () => {
    const paused = rule({ isActive: false, autoPay: true });
    const held = record("2026-11", "pending", { autoPayHold: true });
    assert.equal(only(board({ rules: [paused], records: [held] }).rows).state, "due");
    const pending = record("2026-11", "pending");
    assert.equal(only(board({ rules: [paused], records: [pending] }).rows).willAutoPay, false);
    const saved = record("2026-11", "saved");
    assert.equal(only(board({ rules: [paused], records: [saved] }).rows).willAutoPay, true);
  });

  it("schedules a rule that starts in the future", () => {
    const row = only(board({ rules: [rule({ startsOn: "2027-02-10", dayOfMonth: 10 })] }).rows);
    assert.equal(row.state, "scheduled");
    assert.equal(row.dueDate, "2027-02-10");
    assert.deepEqual([row.canAct, row.canSave, row.canSkip], [false, false, false]);
  });

  it("still lists an active rule the sync has not placed yet", () => {
    const row = only(board({ rules: [rule({ startsOn: "2026-11-05" })] }).rows);
    assert.equal(row.state, "scheduled");
    assert.equal(row.dueDate, "2026-12-05");
    const later = only(board({ rules: [rule({ startsOn: "2026-11-02", dayOfMonth: 20 })] }).rows);
    assert.equal(later.dueDate, "2026-11-20");
  });

  it("leaves out a rule that ended with nothing to show", () => {
    assert.deepEqual(board({ rules: [rule({ endsOn: "2026-08-31" })] }).rows, []);
  });

  it("gives no next date once the rule has ended", () => {
    const ended = rule({ endsOn: "2026-11-30" });
    assert.equal(only(board({ rules: [ended], records: [record("2026-11", "settled")] }).rows).nextDate, null);
  });

  it("uses the category of the record, which can differ from the rule's", () => {
    const other = { ...category, id: "cat-2", name: "Other" };
    const row = only(
      board({ categories: [category, other], records: [record("2026-11", "pending", { categoryId: "cat-2" })] }).rows,
    );
    assert.equal(row.category?.name, "Other");
  });

  it("orders rows by rule and late bills by date", () => {
    const rules = [rule({ id: "a", dayOfMonth: 5 }), rule({ id: "b", dayOfMonth: 6 })];
    const records = [
      record("2026-08", "pending", { id: "a8", ruleId: "a" }),
      record("2026-07", "pending", { id: "b7", ruleId: "b", date: "2026-07-06" }),
      record("2026-11", "pending", { id: "a11", ruleId: "a" }),
      record("2026-11", "pending", { id: "b11", ruleId: "b", date: "2026-11-06" }),
    ];
    const result = board({ rules, records });
    assert.deepEqual(result.rows.map((row) => row.key), ["a11", "b11"]);
    assert.deepEqual(result.late.map((row) => row.key), ["b7", "a8"]);
  });
});

describe("Savings on a row", () => {
  it("is off when another record of the rule is in savings", () => {
    const records = [record("2026-10", "saved"), record("2026-11", "pending")];
    const rows = board({ records }, "2026-11", "2026-11-03").rows;
    assert.deepEqual(rows.map((row) => [row.state, row.canSave]), [
      ["saved", false],
      ["due", false],
    ]);
  });

  it("marks an In savings bill the balance cannot cover", () => {
    const records = [
      record("2026-11", "saved", { id: "soon", ruleId: "a", amount: 300 }),
      record("2026-11", "saved", { id: "later", ruleId: "b", amount: 300, date: "2026-11-09" }),
    ];
    const rules = [rule({ id: "a" }), rule({ id: "b", dayOfMonth: 9 })];
    const rows = board({ rules, records, position: position(500, 600) }).rows;
    assert.deepEqual(rows.map((row) => [row.key, row.funded]), [
      ["soon", true],
      ["later", false],
    ]);
  });

  it("never marks a bill unfunded unless it is in savings", () => {
    const row = only(board({ records: [record("2026-11", "pending")], position: position(0) }).rows);
    assert.equal(row.funded, true);
  });

  it("tells the new Due row about an auto-payment not seen yet", () => {
    const records = [
      record("2026-10", "settled", { autoPaid: true, settledAt: new Date("2026-11-05T00:00:00Z") }),
      record("2026-11", "pending"),
    ];
    const row = only(board({ records }).rows);
    assert.deepEqual(row.unseenAutoPaid, { entryId: "rule:2026-10", period: "2026-10", settledOn: "2026-11-05" });

    const seen = [{ ...records[0], autoPaidSeen: true }, records[1]];
    assert.equal(only(board({ records: seen }).rows).unseenAutoPaid, null);
  });
});

describe("Move all to savings", () => {
  it("adds up what can go in savings and how far it exceeds the balance", () => {
    const rules = [rule({ id: "a" }), rule({ id: "b" })];
    const records = [
      record("2026-11", "pending", { id: "a11", ruleId: "a", amount: 300 }),
      record("2026-11", "pending", { id: "b11", ruleId: "b", amount: 200.5 }),
    ];
    assert.deepEqual(board({ rules, records, position: position(400, 100) }).moveAll, {
      count: 2,
      total: 500.5,
      shortBy: 200.5,
    });
  });

  it("moves one record per rule and nothing that is late", () => {
    const records = [record("2026-09", "pending"), record("2026-10", "pending", { date: "2026-10-05" })];
    const moveAll = board({ rules: [rule({ dayOfMonth: 5 })], records }, "2026-11", "2026-11-03").moveAll;
    assert.equal(moveAll.count, 1);
    assert.equal(moveAll.total, 800);
  });

  it("is empty off the current month and with nothing to move", () => {
    const empty = { count: 0, total: 0, shortBy: 0 };
    assert.deepEqual(board({ records: [record("2026-10", "pending")] }, "2026-10").moveAll, empty);
    assert.deepEqual(board({ records: [record("2026-11", "settled")], position: position(0, 500) }).moveAll, empty);
  });
});

describe("a past month", () => {
  it("shows a paid record as a badge only", () => {
    const row = only(board({ records: [record("2026-09", "settled")] }, "2026-09").rows);
    assert.equal(row.state, "paid");
    assert.equal(row.nextDate, null);
    assert.deepEqual([row.canAct, row.canSkip, row.canManageRule], [false, false, false]);
  });

  it("shows a late bill as a row with Paid and Skip, not Savings", () => {
    const result = board({ records: [record("2026-09", "pending")] }, "2026-09");
    const row = only(result.rows);
    assert.deepEqual(result.late, []);
    assert.equal(row.phase, "late");
    assert.deepEqual([row.canAct, row.canSave, row.canSkip], [true, false, true]);
  });

  it("shows a skipped month", () => {
    const row = only(board({ skips: [{ ruleId: "rule", period: "2026-09" }] }, "2026-09").rows);
    assert.equal(row.state, "skipped");
    assert.equal(row.instancePeriod, "2026-09");
  });

  it("leaves out rules with nothing for that month", () => {
    assert.deepEqual(board({ records: [record("2026-08", "settled")] }, "2026-09").rows, []);
  });
});

describe("a future month", () => {
  it("projects active rules as read-only Scheduled", () => {
    const result = board({}, "2027-02");
    const row = only(result.rows);
    assert.equal(row.state, "scheduled");
    assert.equal(row.dueDate, "2027-02-05");
    assert.deepEqual([row.canAct, row.canSave, row.canSkip, row.canManageRule], [false, false, false, false]);
    assert.equal(result.isCurrent, false);
  });

  it("clamps the projected date to the month", () => {
    assert.equal(only(board({ rules: [rule({ dayOfMonth: 31 })] }, "2027-02").rows).dueDate, "2027-02-28");
  });

  it("shows an existing record with its real state", () => {
    const row = only(board({ records: [record("2027-02", "saved")] }, "2027-02").rows);
    assert.equal(row.state, "saved");
    assert.equal(row.canAct, true);
  });

  it("leaves out paused rules, rules not started and rules that ended", () => {
    assert.deepEqual(board({ rules: [rule({ isActive: false })] }, "2027-02").rows, []);
    assert.deepEqual(board({ rules: [rule({ startsOn: "2027-03-05" })] }, "2027-02").rows, []);
    assert.deepEqual(board({ rules: [rule({ endsOn: "2027-01-31" })] }, "2027-02").rows, []);
  });

  it("includes a rule in the month it starts", () => {
    assert.equal(only(board({ rules: [rule({ startsOn: "2027-02-05" })] }, "2027-02").rows).state, "scheduled");
  });

  it("shows a skipped month", () => {
    assert.equal(only(board({ skips: [{ ruleId: "rule", period: "2027-02" }] }, "2027-02").rows).state, "skipped");
  });
});

describe("totals", () => {
  function historyEntry(status: Entry["status"], amount: number): EntryWithCategory {
    return { ...record("2026-11", status, { id: `h-${status}`, ruleId: null, period: null, amount }), category };
  }

  it("adds rows, late bills and history, in cents", () => {
    const rules = [rule({ id: "a" }), rule({ id: "b" }), rule({ id: "c" })];
    const records = [
      record("2026-11", "settled", { id: "a11", ruleId: "a", amount: 0.1 }),
      record("2026-11", "saved", { id: "b11", ruleId: "b", amount: 0.2 }),
      record("2026-11", "pending", { id: "c11", ruleId: "c", amount: 0.3 }),
      record("2026-10", "pending", { id: "c10", ruleId: "c", amount: 0.4 }),
    ];
    const history = [historyEntry("settled", 1), historyEntry("pending", 2), historyEntry("planned", 4)];
    assert.deepEqual(board({ rules, records }, "2026-11", TODAY, history).totals, {
      total: 4,
      paid: 1.1,
      saved: 0.2,
      due: 2.7,
      count: 6,
      paidCount: 2,
      savedCount: 1,
      dueCount: 3,
    });
  });

  it("is zero with nothing, so the progress bar has nothing to divide", () => {
    const totals = board({ rules: [] }).totals;
    assert.equal(totals.total, 0);
    assert.equal(totals.count, 0);
  });

  it("counts an open bill still running from last month, but not an older paid one", () => {
    const running = board({ records: [record("2026-10", "pending")] }, "2026-11", "2026-11-03").totals;
    assert.deepEqual([running.due, running.dueCount, running.total], [800, 1, 800]);
    const olderPaid = board({ records: [record("2026-09", "settled")] }).totals;
    assert.deepEqual([olderPaid.paid, olderPaid.total, olderPaid.count], [0, 0, 0]);
  });

  it("counts what a paused rule already paid this month", () => {
    const totals = board({ rules: [rule({ isActive: false })], records: [record("2026-11", "settled")] }).totals;
    assert.deepEqual([totals.paid, totals.paidCount], [800, 1]);
  });

  it("leaves out skipped and paused rows", () => {
    assert.equal(board({ skips: [{ ruleId: "rule", period: "2026-11" }] }).totals.total, 0);
    assert.equal(board({ rules: [rule({ isActive: false })] }).totals.total, 0);
  });

  it("projects Scheduled into the total of a future month only", () => {
    const future = board({}, "2027-02").totals;
    assert.deepEqual([future.total, future.count, future.due, future.dueCount], [800, 1, 0, 0]);
    const notYet = board({ rules: [rule({ startsOn: "2027-02-05" })] }).totals;
    assert.equal(notYet.total, 0);
  });
});

describe("the board around the rows", () => {
  it("lists rules adopted and not reviewed yet", () => {
    const rules = [
      rule({ id: "a", source: "adoption", title: "Gym", amount: 30, dayOfMonth: 2 }),
      rule({ id: "b", source: "adoption_ok" }),
      rule({ id: "c", source: "user" }),
    ];
    assert.deepEqual(board({ rules }).adopted, [{ ruleId: "a", title: "Gym", amount: 30, dayOfMonth: 2 }]);
  });

  it("knows whether the viewed month is current", () => {
    assert.equal(board({}, "2026-11").isCurrent, true);
    assert.equal(board({}, "2026-10").isCurrent, false);
  });
});

describe("scheduledBills", () => {
  it("takes only projected rows, in a shape safe for the client", () => {
    const rows = board({ rules: [rule({ id: "a" }), rule({ id: "b" })], records: [record("2027-02", "saved", { ruleId: "b", id: "b2" })] }, "2027-02").rows;
    assert.deepEqual(scheduledBills(rows), [
      {
        ruleId: "a",
        title: "Rent",
        amount: 800,
        date: "2027-02-05",
        category: { name: "Home", icon: "home", color: "stone" },
      },
    ]);
  });
});

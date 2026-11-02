import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import type { Status } from "../config/buckets";
import {
  billPhase,
  cycleProgress,
  dayEditPatch,
  dayOfDate,
  daysBetween,
  firstRecordDate,
  isOpen,
  nextFullOccurrence,
  nextPeriod,
  normalizeTitle,
  occurrence,
  periodOf,
  planAdoption,
  planRuleSync,
  prevPeriod,
  reachedPeriod,
  renewsOn,
  statusPatch,
  uuidFromHex,
  willAutoPay,
  type AdoptionEntry,
  type AdoptionRule,
  type StatusEntry,
  type SyncInstance,
  type SyncPlan,
  type SyncRule,
} from "./cycle";

const EMPTY_PLAN: SyncPlan = { create: [], autoPay: [], skip: [], hold: [] };
const ALL_DAYS = [1, 5, 15, 28, 29, 30, 31];

function rule(overrides: Partial<SyncRule> = {}): SyncRule {
  return {
    id: "rule",
    dayOfMonth: 5,
    isActive: true,
    autoPay: false,
    startsOn: "2026-01-05",
    endsOn: null,
    ...overrides,
  };
}

/** The record's id is its period, so plans read naturally in assertions. */
function record(period: string, status: Status = "settled", autoPayHold = false): SyncInstance {
  return { id: period, period, status, autoPayHold };
}

function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function applyPlan(instances: SyncInstance[], skips: string[], plan: SyncPlan) {
  const paid = new Set(plan.autoPay.map((item) => item.entryId));
  const held = new Set(plan.hold);
  return {
    instances: [
      ...instances.map((item) => {
        if (paid.has(item.id)) return { ...item, status: "settled" as const };
        return held.has(item.id) ? { ...item, autoPayHold: true } : item;
      }),
      ...plan.create.map((item) => record(item.period, item.status)),
    ],
    skips: [...skips, ...plan.skip],
  };
}

const periods = (plan: SyncPlan) => plan.create.map((item) => item.period);

describe("calendar helpers", () => {
  it("clamps an occurrence to the month length", () => {
    assert.equal(occurrence("2026-02", 31), "2026-02-28");
    assert.equal(occurrence("2028-02", 31), "2028-02-29");
    assert.equal(occurrence("2026-04", 31), "2026-04-30");
    assert.equal(occurrence("2026-01", 31), "2026-01-31");
    assert.equal(occurrence("2026-01", 1), "2026-01-01");
  });

  it("steps across a year boundary", () => {
    assert.equal(nextPeriod("2026-12"), "2027-01");
    assert.equal(prevPeriod("2027-01"), "2026-12");
    assert.equal(nextPeriod("2026-09"), "2026-10");
    assert.equal(prevPeriod("2026-10"), "2026-09");
  });

  it("renews one month after the date", () => {
    assert.equal(renewsOn("2026-10", 5), "2026-11-05");
    assert.equal(renewsOn("2026-12", 5), "2027-01-05");
    assert.equal(renewsOn("2026-01", 31), "2026-02-28");
    assert.equal(renewsOn("2026-02", 31), "2026-03-31");
  });

  it("finds the latest period whose occurrence has come", () => {
    assert.equal(reachedPeriod("2026-11-04", 5), "2026-10");
    assert.equal(reachedPeriod("2026-11-05", 5), "2026-11");
    assert.equal(reachedPeriod("2026-11-06", 5), "2026-11");
    assert.equal(reachedPeriod("2027-01-01", 5), "2026-12");
    assert.equal(reachedPeriod("2026-02-27", 31), "2026-01");
    assert.equal(reachedPeriod("2026-02-28", 31), "2026-02");
  });

  it("names each phase of a bill", () => {
    assert.equal(billPhase("2026-11", 5, "2026-11-04"), "upcoming");
    assert.equal(billPhase("2026-11", 5, "2026-11-05"), "today");
    assert.equal(billPhase("2026-11", 5, "2026-11-06"), "open");
    assert.equal(billPhase("2026-11", 5, "2026-12-04"), "open");
    assert.equal(billPhase("2026-11", 5, "2026-12-05"), "late");
    assert.equal(billPhase("2026-11", 5, "2027-03-01"), "late");
  });

  it("counts days and cycle progress with clamping", () => {
    assert.equal(daysBetween("2026-10-05", "2026-11-05"), 31);
    assert.equal(daysBetween("2026-11-05", "2026-10-05"), -31);
    assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);
    // Crosses a daylight saving change in zones that have one; UTC math must not care.
    assert.equal(daysBetween("2026-03-01", "2026-04-01"), 31);
    assert.equal(cycleProgress("2026-11", 5, "2026-10-20"), 0);
    assert.equal(cycleProgress("2026-11", 5, "2026-11-05"), 0);
    assert.equal(cycleProgress("2026-11", 5, "2026-11-20"), 0.5);
    assert.equal(cycleProgress("2026-11", 5, "2026-12-05"), 1);
    assert.equal(cycleProgress("2026-11", 5, "2027-02-01"), 1);
  });

  it("knows which records are open and which will pay by themselves", () => {
    assert.deepEqual(
      (["settled", "pending", "planned", "saved"] as Status[]).filter(isOpen),
      ["pending", "saved"],
    );
    assert.equal(willAutoPay("saved", false, false), true);
    assert.equal(willAutoPay("saved", true, true), false);
    assert.equal(willAutoPay("pending", true, false), true);
    assert.equal(willAutoPay("pending", false, false), false);
    assert.equal(willAutoPay("pending", true, true), false);
    assert.equal(willAutoPay("settled", true, false), false);
    assert.equal(willAutoPay("planned", true, false), false);
  });
});

describe("planRuleSync", () => {
  it("d=5, Oct open (pending, autoPay on), today Dec 2: pays Oct, creates Nov as pending, never creates Dec", () => {
    const plan = planRuleSync(
      rule({ autoPay: true, startsOn: "2026-10-05" }),
      [record("2026-10", "pending")],
      [],
      "2026-12-02",
    );
    assert.deepEqual(plan, {
      autoPay: [{ entryId: "2026-10", settledOn: "2026-11-05" }],
      create: [
        {
          ruleId: "rule",
          period: "2026-11",
          date: "2026-11-05",
          status: "pending",
          autoPaid: false,
          settledOn: null,
        },
      ],
      skip: [],
      hold: [],
    });
  });

  it("a paused rule places nothing and pays no Due bill, autoPay or not", () => {
    for (const autoPay of [false, true]) {
      const paused = rule({ isActive: false, autoPay });
      assert.deepEqual(planRuleSync(paused, [record("2026-12", "pending")], [], "2026-12-02"), EMPTY_PLAN);
      assert.deepEqual(planRuleSync(paused, [record("2026-01")], [], "2026-12-02"), EMPTY_PLAN);
      assert.deepEqual(planRuleSync(paused, [], [], "2026-12-02"), EMPTY_PLAN);

      const late = planRuleSync(paused, [record("2026-01", "pending")], [], "2026-12-02");
      assert.deepEqual([late.autoPay, late.create, late.skip], [[], [], []]);
    }
  });

  it("d=31 through February", () => {
    const d31 = rule({ dayOfMonth: 31, startsOn: "2026-01-31" });

    const beforeFeb = planRuleSync(d31, [record("2026-01", "saved")], [], "2026-02-27");
    assert.deepEqual(beforeFeb, EMPTY_PLAN);

    const onFeb = planRuleSync(d31, [record("2026-01", "saved")], [], "2026-02-28");
    assert.deepEqual(onFeb.autoPay, [{ entryId: "2026-01", settledOn: "2026-02-28" }]);
    assert.deepEqual(onFeb.create[0], {
      ruleId: "rule",
      period: "2026-02",
      date: "2026-02-28",
      status: "pending",
      autoPaid: false,
      settledOn: null,
    });

    const onMarch = planRuleSync(d31, [record("2026-01"), record("2026-02", "saved")], [], "2026-03-31");
    assert.deepEqual(onMarch.autoPay, [{ entryId: "2026-02", settledOn: "2026-03-31" }]);
    assert.deepEqual(periods(onMarch), ["2026-03"]);

    const midMarch = planRuleSync(d31, [record("2026-01"), record("2026-02", "saved")], [], "2026-03-30");
    assert.deepEqual(midMarch.autoPay, []);
  });

  it("d=31 through February of a leap year", () => {
    const d31 = rule({ dayOfMonth: 31, startsOn: "2028-01-31" });

    assert.deepEqual(planRuleSync(d31, [record("2028-01", "saved")], [], "2028-02-28"), EMPTY_PLAN);

    const onLeapDay = planRuleSync(d31, [record("2028-01", "saved")], [], "2028-02-29");
    assert.deepEqual(onLeapDay.autoPay, [{ entryId: "2028-01", settledOn: "2028-02-29" }]);
    assert.equal(onLeapDay.create[0].date, "2028-02-29");
  });

  it("today == occurrence: the month's record is placed and is due today", () => {
    const plan = planRuleSync(rule(), [record("2026-10")], [], "2026-11-05");
    assert.deepEqual(periods(plan), ["2026-11"]);
    assert.equal(plan.create[0].date, "2026-11-05");
    assert.equal(billPhase("2026-11", 5, "2026-11-05"), "today");
  });

  it("today == renewsOn: the old record pays and the next one appears on the same day", () => {
    const plan = planRuleSync(rule(), [record("2026-10", "saved")], [], "2026-11-05");
    assert.deepEqual(plan.autoPay, [{ entryId: "2026-10", settledOn: "2026-11-05" }]);
    assert.deepEqual(periods(plan), ["2026-11"]);
  });

  it("the day before renewal nothing pays", () => {
    const plan = planRuleSync(rule(), [record("2026-10", "saved")], [], "2026-11-04");
    assert.deepEqual(plan, EMPTY_PLAN);
  });

  it("saved always pays, even with autoPay off", () => {
    const plan = planRuleSync(rule({ autoPay: false }), [record("2026-10", "saved")], [], "2026-11-06");
    assert.deepEqual(plan.autoPay, [{ entryId: "2026-10", settledOn: "2026-11-05" }]);
  });

  it("pending with autoPay off stays and turns late, and next month is still placed", () => {
    const plan = planRuleSync(rule({ autoPay: false }), [record("2026-10", "pending")], [], "2026-11-06");
    assert.deepEqual(plan.autoPay, []);
    assert.deepEqual(periods(plan), ["2026-11"]);
    assert.equal(billPhase("2026-10", 5, "2026-11-06"), "late");
  });

  it("held stays and does not block placement", () => {
    const today = "2026-11-06";
    const heldPending = planRuleSync(rule({ autoPay: true }), [record("2026-10", "pending", true)], [], today);
    assert.deepEqual(heldPending.autoPay, []);
    assert.deepEqual(periods(heldPending), ["2026-11"]);

    const early = planRuleSync(
      rule({ autoPay: true }),
      [record("2026-10", "pending", true), record("2026-11")],
      [],
      "2026-12-02",
    );
    assert.deepEqual(early.autoPay, []);
    assert.deepEqual(periods(early), ["2026-12"]);
  });

  it("long absence with autoPay off: months become skips and one record is open", () => {
    const plan = planRuleSync(rule({ autoPay: false }), [record("2026-01")], [], "2026-07-20");
    assert.deepEqual(plan.skip, ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
    assert.deepEqual(plan.create.map((item) => [item.period, item.status]), [["2026-07", "pending"]]);
    assert.deepEqual(plan.autoPay, []);
  });

  it("long absence with autoPay on: settled rows and one record open", () => {
    const plan = planRuleSync(rule({ autoPay: true }), [record("2026-01", "pending")], [], "2026-05-20");
    assert.deepEqual(plan.autoPay, [{ entryId: "2026-01", settledOn: "2026-02-05" }]);
    assert.deepEqual(plan.skip, []);
    assert.deepEqual(
      plan.create.map((item) => [item.period, item.status, item.autoPaid, item.settledOn]),
      [
        ["2026-02", "settled", true, "2026-03-05"],
        ["2026-03", "settled", true, "2026-04-05"],
        ["2026-04", "settled", true, "2026-05-05"],
        ["2026-05", "pending", false, null],
      ],
    );
  });

  it("a future row at reached+2 does not stall the walk", () => {
    const plan = planRuleSync(rule(), [record("2026-09"), record("2027-02", "pending")], [], "2026-12-06");
    assert.deepEqual(plan.skip, ["2026-10", "2026-11"]);
    assert.deepEqual(periods(plan), ["2026-12"]);
  });

  it("startsOn in a future period places nothing until it arrives", () => {
    const later = rule({ startsOn: "2027-02-10", dayOfMonth: 10 });
    assert.deepEqual(planRuleSync(later, [], [], "2026-12-20"), EMPTY_PLAN);
    assert.deepEqual(planRuleSync(later, [], [], "2027-01-31"), EMPTY_PLAN);
    assert.deepEqual(periods(planRuleSync(later, [], [], "2027-02-01")), ["2027-02"]);
  });

  it("startsOn never lets the walk reach back past it", () => {
    const resumed = rule({ startsOn: "2026-11-05" });
    const plan = planRuleSync(resumed, [record("2026-08")], [], "2026-11-10");
    assert.deepEqual(plan.skip, []);
    assert.deepEqual(periods(plan), ["2026-11"]);
  });

  it("endsOn is respected by the walk", () => {
    const ended = rule({ autoPay: false, startsOn: "2026-01-05", endsOn: "2026-03-20" });
    const plan = planRuleSync(ended, [record("2026-01")], [], "2026-06-20");
    assert.deepEqual(plan.skip, ["2026-02", "2026-03"]);
    assert.deepEqual(plan.create, []);

    const autoPaid = planRuleSync({ ...ended, autoPay: true }, [record("2026-01")], [], "2026-06-20");
    assert.deepEqual(periods(autoPaid), ["2026-02", "2026-03"]);
    assert.ok(autoPaid.create.every((item) => item.status === "settled"));
  });

  it("endsOn is respected by early placement", () => {
    const today = "2026-12-02";
    const endedLastMonth = rule({ endsOn: "2026-11-30" });
    assert.deepEqual(planRuleSync(endedLastMonth, [record("2026-11")], [], today), EMPTY_PLAN);

    const endsThisMonth = rule({ endsOn: "2026-12-31" });
    assert.deepEqual(periods(planRuleSync(endsThisMonth, [record("2026-11")], [], today)), ["2026-12"]);
  });

  it("places the current month early when nothing earlier is waiting", () => {
    const paid = planRuleSync(rule(), [record("2026-11")], [], "2026-12-01");
    assert.deepEqual(periods(paid), ["2026-12"]);
    assert.equal(paid.create[0].date, "2026-12-05");

    const waiting = planRuleSync(rule(), [record("2026-11", "pending")], [], "2026-12-01");
    assert.deepEqual(waiting, EMPTY_PLAN);

    const saved = planRuleSync(rule(), [record("2026-11", "saved")], [], "2026-12-04");
    assert.deepEqual(saved, EMPTY_PLAN);

    const lateElsewhere = planRuleSync(
      rule(),
      [record("2026-10", "pending"), record("2026-11")],
      [],
      "2026-12-02",
    );
    assert.deepEqual(lateElsewhere, EMPTY_PLAN);
  });

  it("skip of the current month, then of the next", () => {
    const instances = [record("2026-10")];
    const skips = ["2026-11"];

    assert.deepEqual(planRuleSync(rule(), instances, skips, "2026-11-06"), EMPTY_PLAN);
    assert.deepEqual(planRuleSync(rule(), instances, skips, "2026-11-30"), EMPTY_PLAN);

    const december = planRuleSync(rule(), instances, skips, "2026-12-01");
    assert.deepEqual(periods(december), ["2026-12"]);

    // December was placed early and the user skipped it too.
    skips.push("2026-12");
    assert.deepEqual(planRuleSync(rule(), instances, skips, "2026-12-02"), EMPTY_PLAN);
    assert.deepEqual(planRuleSync(rule(), instances, skips, "2026-12-06"), EMPTY_PLAN);
    assert.deepEqual(periods(planRuleSync(rule(), instances, skips, "2027-01-01")), ["2027-01"]);
  });

  it("keeps the newest months when the gap is over the walk cap", () => {
    const plan = planRuleSync(rule({ startsOn: "2000-01-05" }), [], [], "2026-11-10");
    assert.equal(plan.skip.length + plan.create.length, 240);
    assert.deepEqual(periods(plan), ["2026-11"]);
    assert.equal(plan.skip[0], "2006-12");
  });

  it("ignores instances without a period", () => {
    const plan = planRuleSync(
      rule(),
      [{ id: "x", period: null, status: "pending", autoPayHold: false }],
      [],
      "2026-01-05",
    );
    assert.deepEqual(periods(plan), ["2026-01"]);
  });

  it("idempotence: applying a plan then replanning yields empty", () => {
    const scenarios: { rule: SyncRule; instances: SyncInstance[]; skips: string[]; today: string }[] = [
      { rule: rule({ autoPay: true }), instances: [record("2026-10", "pending")], skips: [], today: "2026-12-02" },
      { rule: rule({ autoPay: false }), instances: [record("2026-01")], skips: [], today: "2026-07-20" },
      { rule: rule({ autoPay: true }), instances: [record("2026-01", "saved")], skips: [], today: "2026-07-01" },
      { rule: rule(), instances: [record("2026-11")], skips: [], today: "2026-12-01" },
      { rule: rule({ dayOfMonth: 31 }), instances: [record("2026-01", "saved")], skips: [], today: "2026-02-28" },
      { rule: rule({ endsOn: "2026-03-20" }), instances: [record("2026-01")], skips: [], today: "2026-06-20" },
      { rule: rule(), instances: [], skips: [], today: "2026-02-01" },
      { rule: rule(), instances: [record("2027-02", "pending")], skips: ["2026-01"], today: "2026-12-06" },
      {
        rule: rule({ autoPay: true }),
        instances: [record("2026-10", "pending"), record("2026-11", "pending"), record("2027-01", "pending")],
        skips: [],
        today: "2026-11-03",
      },
      {
        rule: rule({ autoPay: true }),
        instances: [record("2026-11"), record("2027-01", "saved")],
        skips: [],
        today: "2026-12-02",
      },
      { rule: rule({ isActive: false }), instances: [record("2026-10", "saved")], skips: [], today: "2026-12-02" },
    ];
    for (const scenario of scenarios) {
      const plan = planRuleSync(scenario.rule, scenario.instances, scenario.skips, scenario.today);
      const applied = applyPlan(scenario.instances, scenario.skips, plan);
      assert.deepEqual(planRuleSync(scenario.rule, applied.instances, applied.skips, scenario.today), EMPTY_PLAN);
    }
  });

  it("never two auto-payable open records", () => {
    for (const day of ALL_DAYS) {
      const autoRule = rule({ autoPay: true, dayOfMonth: day, startsOn: occurrence("2026-01", day) });
      let instances: SyncInstance[] = [];
      let skips: string[] = [];
      for (let today = "2026-01-01"; today < "2027-06-01"; today = addDays(today, 1)) {
        const applied = applyPlan(instances, skips, planRuleSync(autoRule, instances, skips, today));
        instances = applied.instances;
        skips = applied.skips;
        const payable = instances.filter((item) => willAutoPay(item.status, autoRule.autoPay, item.autoPayHold));
        assert.ok(payable.length <= 1, `day ${day} on ${today}: ${payable.length} auto-payable`);
      }
    }
  });

  it("nothing pays earlier than one month after its date", () => {
    for (const day of ALL_DAYS) {
      for (const period of ["2026-01", "2026-02", "2028-01", "2028-02", "2026-12"]) {
        const instances = [record(period, "saved")];
        const autoRule = rule({ autoPay: true, dayOfMonth: day, startsOn: occurrence(period, day) });
        const renewal = renewsOn(period, day);
        for (let today = occurrence(period, day); today < renewal; today = addDays(today, 1)) {
          assert.deepEqual(planRuleSync(autoRule, instances, [], today).autoPay, [], `${period} d=${day} on ${today}`);
        }
        assert.deepEqual(planRuleSync(autoRule, instances, [], renewal).autoPay, [
          { entryId: period, settledOn: renewal },
        ]);
        assert.ok(daysBetween(occurrence(period, day), renewal) >= 28);
      }
    }
  });

  it("a day edit alone never yields autoPay", () => {
    const todays = Array.from({ length: 75 }, (_, i) => addDays("2026-01-20", i));
    for (const oldDay of ALL_DAYS) {
      for (const newDay of ALL_DAYS) {
        for (const autoPay of [true, false]) {
          for (const status of ["pending", "saved"] as const) {
            for (const today of todays) {
              const period = reachedPeriod(today, oldDay);
              const edit = dayEditPatch(period, newDay, today);
              const edited: SyncInstance = {
                id: period,
                period,
                status: edit.status ?? status,
                autoPayHold: edit.autoPayHold ?? false,
              };
              const editedRule = rule({ dayOfMonth: newDay, autoPay, startsOn: occurrence(period, oldDay) });
              const plan = planRuleSync(editedRule, [edited], [], today);
              const context = `${oldDay}->${newDay} autoPay=${autoPay} ${status} on ${today}`;
              assert.deepEqual(plan.autoPay, [], context);
              assert.ok(
                plan.create.every((item) => item.status === "pending"),
                context,
              );
            }
          }
        }
      }
    }
  });
});

describe("planRuleSync on a paused rule", () => {
  it("a bill saved while the rule is paused still settles at renewsOn", () => {
    const paused = rule({ isActive: false });
    assert.deepEqual(planRuleSync(paused, [record("2026-10", "saved")], [], "2026-11-04"), EMPTY_PLAN);
    assert.deepEqual(planRuleSync(paused, [record("2026-10", "saved")], [], "2026-11-05"), {
      ...EMPTY_PLAN,
      autoPay: [{ entryId: "2026-10", settledOn: "2026-11-05" }],
    });
  });

  it("settles saved money without touching the Due bill beside it", () => {
    const plan = planRuleSync(
      rule({ isActive: false, autoPay: true }),
      [record("2026-09", "pending"), record("2026-10", "saved")],
      [],
      "2026-12-02",
    );
    assert.deepEqual(plan.autoPay, [{ entryId: "2026-10", settledOn: "2026-11-05" }]);
    assert.deepEqual(plan.create, []);
    assert.deepEqual(plan.skip, []);
  });

  it("a Due bill whose month ends during the pause is held, so resuming cannot pay it", () => {
    const instances = [record("2026-10", "pending")];
    const paused = rule({ isActive: false, autoPay: true });
    assert.deepEqual(planRuleSync(paused, instances, [], "2026-11-04"), EMPTY_PLAN);

    const plan = planRuleSync(paused, instances, [], "2026-11-05");
    assert.deepEqual(plan, { ...EMPTY_PLAN, hold: ["2026-10"] });

    const applied = applyPlan(instances, [], plan);
    const resumed = rule({ autoPay: true, startsOn: "2026-11-05" });
    const afterResume = planRuleSync(resumed, applied.instances, [], "2026-11-20");
    assert.deepEqual(afterResume.autoPay, []);
    assert.deepEqual(periods(afterResume), ["2026-11"]);
  });

  it("with autoPay off that bill pays nothing anyway, so it is left as it is", () => {
    const paused = rule({ isActive: false, autoPay: false });
    assert.deepEqual(planRuleSync(paused, [record("2026-10", "pending")], [], "2026-11-05"), EMPTY_PLAN);
  });

  it("a late bill beside a reopened one on a paused rule leaves one payer", () => {
    const plan = planRuleSync(
      rule({ isActive: false, autoPay: true, dayOfMonth: 29 }),
      [record("2100-09", "pending"), record("2100-10", "pending")],
      [],
      "2100-11-21",
    );
    assert.deepEqual(plan, { ...EMPTY_PLAN, hold: ["2100-09"] });
  });
});

describe("one running record pays by itself", () => {
  it("bringing back last month beside this month's bill holds the older one", () => {
    const instances = [record("2026-10", "pending"), record("2026-11", "pending")];
    const plan = planRuleSync(rule({ autoPay: true }), instances, [], "2026-11-03");
    assert.deepEqual(plan, { ...EMPTY_PLAN, hold: ["2026-10"] });

    const applied = applyPlan(instances, [], plan);
    const payable = applied.instances.filter((item) => willAutoPay(item.status, true, item.autoPayHold));
    assert.deepEqual(payable.map((item) => item.id), ["2026-11"]);

    const onRenewal = planRuleSync(rule({ autoPay: true }), applied.instances, [], "2026-11-05");
    assert.deepEqual(onRenewal, EMPTY_PLAN);
  });

  it("reopening last month beside this month's saved bill holds the reopened one", () => {
    const plan = planRuleSync(
      rule({ autoPay: true }),
      [record("2026-10", "pending"), record("2026-11", "saved")],
      [],
      "2026-11-03",
    );
    assert.deepEqual(plan, { ...EMPTY_PLAN, hold: ["2026-10"] });
  });

  it("a saved older month wins over a pending newer one, since saved cannot be held", () => {
    const plan = planRuleSync(
      rule({ autoPay: true }),
      [record("2026-10", "saved"), record("2026-11", "pending")],
      [],
      "2026-11-03",
    );
    assert.deepEqual(plan, { ...EMPTY_PLAN, hold: ["2026-11"] });
  });

  it("with autoPay off a Due bill pays nothing, so nothing needs holding", () => {
    const plan = planRuleSync(
      rule({ autoPay: false }),
      [record("2026-10", "pending"), record("2026-11", "pending")],
      [],
      "2026-11-03",
    );
    assert.deepEqual(plan, EMPTY_PLAN);
  });

  it("turning autoPay on with a future row beside the running bill keeps the running bill", () => {
    const plan = planRuleSync(
      rule({ autoPay: true }),
      [record("2026-11", "pending"), record("2027-01", "pending")],
      [],
      "2026-11-10",
    );
    assert.deepEqual(plan, { ...EMPTY_PLAN, hold: ["2027-01"] });
  });

  it("with only future rows the earliest keeps paying", () => {
    const plan = planRuleSync(
      rule({ autoPay: true }),
      [record("2026-11"), record("2026-12", "pending"), record("2027-02", "pending")],
      [],
      "2026-11-10",
    );
    assert.deepEqual(plan, { ...EMPTY_PLAN, hold: ["2027-02"] });
  });

  it("a day edit that makes a late bill current again leaves one payer after autoPay turns on", () => {
    const today = "2026-11-10";
    const late = record("2026-10", "pending");
    const running = record("2026-11", "pending");
    assert.equal(billPhase("2026-10", 5, today), "late");
    assert.equal(billPhase("2026-10", 25, today), "open");

    const plan = planRuleSync(rule({ dayOfMonth: 25, autoPay: true }), [late, running], [], today);
    assert.deepEqual(plan, { ...EMPTY_PLAN, hold: ["2026-10"] });
  });

  it("placing this month holds a pending future row instead of skipping the month", () => {
    const plan = planRuleSync(rule({ autoPay: true }), [record("2026-11"), record("2027-01", "pending")], [], "2026-12-01");
    assert.deepEqual(periods(plan), ["2026-12"]);
    assert.deepEqual(plan.hold, ["2027-01"]);
    assert.deepEqual(plan.skip, []);
  });

  it("with autoPay on nothing is placed beneath a saved future row", () => {
    const instances = [record("2026-11"), record("2027-01", "saved")];
    const early = planRuleSync(rule({ autoPay: true }), instances, [], "2026-12-01");
    assert.deepEqual(early, EMPTY_PLAN);

    const reached = planRuleSync(rule({ autoPay: true }), instances, [], "2026-12-05");
    assert.deepEqual(reached, { ...EMPTY_PLAN, skip: ["2026-12"] });
  });

  it("with autoPay off a month placed beneath a saved future row pays nothing, so it is placed", () => {
    const instances = [record("2026-11"), record("2027-01", "saved")];
    assert.deepEqual(periods(planRuleSync(rule({ autoPay: false }), instances, [], "2026-12-01")), ["2026-12"]);
    assert.deepEqual(periods(planRuleSync(rule({ autoPay: false }), instances, [], "2026-12-05")), ["2026-12"]);
  });
});

describe("a record in the current month closes the walk", () => {
  it("a day edit cannot refill older months with settled rows", () => {
    const instances = [record("2029-04"), record("2029-05"), record("2029-06"), record("2029-09", "saved")];
    const edited = rule({ dayOfMonth: 29, autoPay: true, startsOn: "2029-04-11" });
    assert.deepEqual(planRuleSync(edited, instances, [], "2029-09-28"), EMPTY_PLAN);
    assert.deepEqual(planRuleSync(edited, instances, [], "2029-09-29"), EMPTY_PLAN);
  });

  it("deleting last month's paid bill does not bring it back beside this month's", () => {
    const instances = [record("2026-09"), record("2026-11", "pending")];
    assert.deepEqual(planRuleSync(rule({ autoPay: true }), instances, [], "2026-11-03"), EMPTY_PLAN);
    assert.deepEqual(planRuleSync(rule({ autoPay: false }), instances, [], "2026-11-03"), EMPTY_PLAN);
  });

  it("gives the same answer before and after the day of the month", () => {
    const instances = [record("2026-01"), record("2026-11")];
    for (const autoPay of [false, true]) {
      const current = rule({ autoPay });
      assert.deepEqual(
        planRuleSync(current, instances, [], "2026-11-04"),
        planRuleSync(current, instances, [], "2026-11-05"),
      );
    }
  });
});

describe("dayEditPatch", () => {
  it("moves the date inside the record's own period", () => {
    assert.deepEqual(dayEditPatch("2026-02", 31, "2026-02-10"), { date: "2026-02-28" });
  });

  it("turns a saved record that would be instantly due into pending and held", () => {
    assert.deepEqual(dayEditPatch("2026-10", 5, "2026-11-10"), {
      date: "2026-10-05",
      status: "pending",
      savedAt: null,
      autoPayHold: true,
    });
  });
});

/** Same seed, same run, so a failure names the case that reproduces it. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SimRecord = SyncInstance & { period: string; date: string; touched: boolean };

type Sim = { rule: SyncRule; records: SimRecord[]; skips: string[]; label: string };

const AMOUNT = 100;

function freeToSpend(records: SimRecord[]) {
  return records.reduce((free, item) => (item.status === "planned" ? free : free - AMOUNT), 0);
}

function assertPlanIsSound(sim: Sim, plan: SyncPlan, today: string) {
  const { rule: current, records, skips, label } = sim;
  const day = current.dayOfMonth;
  const todayP = periodOf(today);
  const endP = current.endsOn ? periodOf(current.endsOn) : null;
  const known = new Set([...records.map((item) => item.period), ...skips]);
  const seen = new Set<string>();

  for (const item of plan.create) {
    assert.ok(!known.has(item.period) && !seen.has(item.period), `${label}: duplicate month ${item.period}`);
    seen.add(item.period);
    assert.ok(item.period <= todayP, `${label}: materialized the future month ${item.period} on ${today}`);
    assert.ok(item.period >= periodOf(current.startsOn), `${label}: ${item.period} is before the start`);
    assert.ok(endP === null || item.period <= endP, `${label}: ${item.period} is after the end`);
    assert.equal(item.date, occurrence(item.period, day), label);
    const renewal = renewsOn(item.period, day);
    if (item.status === "pending") {
      assert.ok(renewal > today, `${label}: placed a bill that is already over on ${today}`);
      assert.deepEqual([item.autoPaid, item.settledOn], [false, null], label);
    } else {
      assert.ok(current.autoPay, `${label}: invented a settled row without autoPay`);
      assert.ok(renewal <= today, label);
      assert.deepEqual([item.autoPaid, item.settledOn], [true, renewal], label);
    }
  }

  for (const period of plan.skip) {
    assert.ok(!known.has(period) && !seen.has(period), `${label}: skipped a known month ${period}`);
    seen.add(period);
    assert.ok(!current.autoPay, `${label}: skipped with autoPay on`);
    assert.ok(renewsOn(period, day) <= today, `${label}: skipped a month still running ${period} on ${today}`);
  }

  for (const payment of plan.autoPay) {
    const paid = records.find((item) => item.id === payment.entryId);
    assert.ok(paid, label);
    assert.ok(isOpen(paid.status) && !paid.autoPayHold, `${label}: paid a closed or held record`);
    assert.ok(
      paid.status === "saved" || (current.autoPay && current.isActive),
      `${label}: paid an untouched bill with autoPay off or on a paused rule`,
    );
    assert.equal(payment.settledOn, renewsOn(paid.period, day), label);
    assert.ok(payment.settledOn <= today, `${label}: paid ahead of renewal on ${today}`);
    assert.ok(daysBetween(occurrence(paid.period, day), payment.settledOn) >= 28, `${label}: paid within the month`);
  }

  for (const id of plan.hold) {
    const held = records.find((item) => item.id === id);
    assert.ok(held?.status === "pending" && !held.autoPayHold, `${label}: held something other than a free Due bill`);
    assert.ok(current.autoPay, `${label}: held a bill with autoPay off`);
    assert.ok(
      renewsOn(held.period, day) > today || !current.isActive,
      `${label}: held a bill the plan should have paid`,
    );
  }
}

function assertStateIsSound(sim: Sim, today: string) {
  const { rule: current, records, skips, label } = sim;
  const day = current.dayOfMonth;
  const context = `${label} on ${today}`;

  const payable = records.filter((item) => willAutoPay(item.status, current.autoPay, item.autoPayHold));
  assert.ok(payable.length <= 1, `${context}: ${payable.length} auto-payable records`);
  for (const item of payable) {
    assert.ok(renewsOn(item.period, day) > today, `${context}: an auto-payable record outlived its renewal`);
  }
  if (!current.isActive) return;

  const months = records.map((item) => item.period);
  assert.equal(new Set(months).size, months.length, `${context}: two records in one month`);
  for (const skipped of skips) assert.ok(!months.includes(skipped), `${context}: ${skipped} is skipped and placed`);
  for (const month of months) assert.ok(month <= periodOf(today), `${context}: browsed-future record ${month}`);

  const endP = current.endsOn ? periodOf(current.endsOn) : null;
  const uncapped = reachedPeriod(today, day);
  const reached = endP && endP < uncapped ? endP : uncapped;
  const known = new Set([...months, ...skips]);
  for (let period = periodOf(current.startsOn); period <= reached; period = nextPeriod(period)) {
    assert.ok(known.has(period), `${context}: ${period} fell through the walk`);
  }
}

function sync(sim: Sim, today: string) {
  const plan = planRuleSync(sim.rule, sim.records, sim.skips, today);
  assertPlanIsSound(sim, plan, today);

  const free = freeToSpend(sim.records);
  for (const payment of plan.autoPay) {
    const paid = sim.records.find((item) => item.id === payment.entryId);
    if (paid) paid.status = "settled";
  }
  assert.equal(freeToSpend(sim.records), free, `${sim.label}: auto-pay moved free to spend`);

  for (const item of plan.create) {
    sim.records.push({
      id: item.period,
      period: item.period,
      date: item.date,
      status: item.status,
      autoPayHold: false,
      touched: false,
    });
  }
  sim.skips.push(...plan.skip);
  for (const id of plan.hold) {
    const held = sim.records.find((item) => item.id === id);
    if (held) held.autoPayHold = true;
  }

  assertStateIsSound(sim, today);
  assert.deepEqual(
    planRuleSync(sim.rule, sim.records, sim.skips, today),
    EMPTY_PLAN,
    `${sim.label}: not idempotent on ${today}`,
  );
}

function applyStatus(sim: Sim, target: SimRecord, next: Status, today: string) {
  const entry: StatusEntry = {
    kind: "credit",
    bucket: "fixed",
    status: target.status,
    ruleId: sim.rule.id,
    period: target.period,
    date: target.date,
  };
  const otherSaved = sim.records.some((item) => item !== target && item.status === "saved");
  const result = statusPatch(entry, next, {
    today,
    ruleDay: sim.rule.dayOfMonth,
    now: new Date(`${today}T12:00:00Z`),
    otherSaved,
  });
  if (!result.ok) return result;
  target.status = result.patch.status;
  target.autoPayHold = result.patch.autoPayHold ?? target.autoPayHold;
  target.touched = true;
  return result;
}

function pickOne<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

/** Whatever a user can do between visits, as the actions apply it. */
function userActs(sim: Sim, today: string, random: () => number) {
  const day = () => sim.rule.dayOfMonth;

  for (const target of sim.records.filter((item) => isOpen(item.status))) {
    const roll = random();
    if (roll < 0.25) {
      assert.ok(applyStatus(sim, target, "settled", today).ok, sim.label);
    } else if (roll < 0.45 && target.status === "pending") {
      const otherSaved = sim.records.some((item) => item !== target && item.status === "saved");
      const allowed = renewsOn(target.period, day()) > today && !otherSaved;
      assert.equal(applyStatus(sim, target, "saved", today).ok, allowed, `${sim.label}: saving on ${today}`);
    } else if (roll < 0.5 && target.status === "saved") {
      assert.ok(applyStatus(sim, target, "pending", today).ok, sim.label);
    } else if (roll < 0.58) {
      sim.records.splice(sim.records.indexOf(target), 1);
      sim.skips.push(target.period);
    }
  }

  if (random() < 0.15) {
    const reopened = pickOne(
      sim.records.filter((item) => item.status === "settled"),
      random,
    );
    if (reopened) {
      const following = sim.records.find((item) => item.period === nextPeriod(reopened.period));
      if (following && following.status === "pending" && following.date > today && !following.touched) {
        sim.records.splice(sim.records.indexOf(following), 1);
      }
      assert.ok(applyStatus(sim, reopened, "pending", today).ok, sim.label);
    }
  }

  if (random() < 0.1) {
    sim.rule.autoPay = !sim.rule.autoPay;
    if (sim.rule.autoPay) {
      for (const item of sim.records) {
        if (item.status === "pending" && renewsOn(item.period, day()) <= today) item.autoPayHold = true;
      }
    }
  }

  if (random() < 0.1 && sim.skips.length > 0 && sim.rule.isActive) {
    const period = pickOne(sim.skips, random);
    sim.skips.splice(sim.skips.indexOf(period), 1);
    sim.records.push({
      id: period,
      period,
      date: occurrence(period, day()),
      status: "pending",
      autoPayHold: renewsOn(period, day()) <= today,
      touched: false,
    });
  }

  if (random() < 0.08) {
    const newDay = pickOne(ALL_DAYS, random);
    sim.rule.dayOfMonth = newDay;
    for (const item of sim.records) {
      if (!isOpen(item.status) || item.autoPayHold) continue;
      const edit = dayEditPatch(item.period, newDay, today);
      item.date = edit.date;
      item.status = edit.status ?? item.status;
      item.autoPayHold = edit.autoPayHold ?? item.autoPayHold;
      item.touched = true;
    }
  }

  if (random() < 0.08) {
    if (sim.rule.isActive) {
      sim.rule.isActive = false;
      sim.records = sim.records.filter(
        (item) => !isOpen(item.status) || item.autoPayHold || renewsOn(item.period, day()) <= today,
      );
    } else {
      sim.rule.isActive = true;
      sim.rule.startsOn = occurrence(periodOf(today), day());
    }
  }
}

function visitGap(random: () => number) {
  const roll = random();
  if (roll < 0.5) return 1 + Math.floor(random() * 7);
  if (roll < 0.85) return 8 + Math.floor(random() * 38);
  return 46 + Math.floor(random() * 400);
}

describe("replay fuzz", () => {
  for (const day of ALL_DAYS) {
    it(`rule day ${day}: random visit gaps and user actions`, () => {
      for (let seed = 1; seed <= 150; seed++) {
        const random = seededRandom(day * 10_000 + seed);
        let today = addDays("2024-01-01", Math.floor(random() * 500));
        const startsOn = random() < 0.2 ? addDays(today, Math.floor(random() * 90)) : today;
        const sim: Sim = {
          label: `day=${day} seed=${seed}`,
          skips: [],
          records: [],
          rule: {
            id: "rule",
            dayOfMonth: day,
            isActive: true,
            autoPay: random() < 0.5,
            startsOn,
            endsOn: random() < 0.15 ? addDays(startsOn, 100 + Math.floor(random() * 700)) : null,
          },
        };

        for (let visit = 0; visit < 40; visit++) {
          today = addDays(today, visitGap(random));
          sync(sim, today);
          userActs(sim, today, random);
          sync(sim, today);
        }
      }
    });
  }
});

describe("statusPatch", () => {
  const now = new Date("2026-11-10T09:30:00Z");
  const today = "2026-11-10";
  const bill: StatusEntry = {
    kind: "credit",
    bucket: "fixed",
    status: "pending",
    ruleId: "rule",
    period: "2026-11",
    date: "2026-11-05",
  };
  const context = { today, ruleDay: 5, now };

  it("saves a running bill", () => {
    assert.deepEqual(statusPatch(bill, "saved", context), {
      ok: true,
      patch: { status: "saved", savedAt: now, settledAt: null, autoPaid: false, autoPayHold: false },
    });
  });

  it("saves a bill placed early, ahead of its date", () => {
    const early = { ...bill, period: "2026-11", date: "2026-11-25" };
    const result = statusPatch(early, "saved", { ...context, ruleDay: 25 });
    assert.equal(result.ok, true);
  });

  it("refuses to save anything but a rule-linked fixed credit", () => {
    const refused = { ok: false, errorKey: "validation.savedNeedsBill" };
    assert.deepEqual(statusPatch({ ...bill, ruleId: null }, "saved", { ...context, ruleDay: null }), refused);
    assert.deepEqual(statusPatch({ ...bill, ruleId: null }, "saved", context), refused);
    assert.deepEqual(statusPatch({ ...bill, kind: "debit", bucket: "pending" }, "saved", context), refused);
    assert.deepEqual(statusPatch({ ...bill, kind: "debit" }, "saved", context), refused);
    assert.deepEqual(statusPatch({ ...bill, bucket: "daily" }, "saved", context), refused);
    assert.deepEqual(statusPatch(bill, "saved", { ...context, ruleDay: null }), refused);
  });

  it("refuses to save a late bill", () => {
    const late = { ...bill, period: "2026-10", date: "2026-10-05" };
    assert.deepEqual(statusPatch(late, "saved", context), { ok: false, errorKey: "validation.savedCycleOver" });
    const edge = { ...bill, period: "2026-10", date: "2026-10-10" };
    assert.deepEqual(statusPatch(edge, "saved", { ...context, ruleDay: 10 }), {
      ok: false,
      errorKey: "validation.savedCycleOver",
    });
  });

  it("settling a bill keeps its date and savedAt and clears the hold", () => {
    assert.deepEqual(statusPatch({ ...bill, status: "saved" }, "settled", context), {
      ok: true,
      patch: { status: "settled", settledAt: now, autoPaid: false, autoPayHold: false },
    });
  });

  it("settling a non-rule record stamps today and follows the debit pipeline", () => {
    const invoice: StatusEntry = {
      kind: "debit",
      bucket: "pending",
      status: "pending",
      ruleId: null,
      period: null,
      date: "2026-09-01",
    };
    assert.deepEqual(statusPatch(invoice, "settled", { ...context, ruleDay: null }), {
      ok: true,
      patch: {
        status: "settled",
        settledAt: now,
        autoPaid: false,
        autoPayHold: false,
        bucket: "wallet",
        date: today,
      },
    });

    const coffee: StatusEntry = { ...invoice, kind: "credit", bucket: "optional", status: "planned" };
    const paid = statusPatch(coffee, "settled", { ...context, ruleDay: null });
    assert.deepEqual(paid, {
      ok: true,
      patch: { status: "settled", settledAt: now, autoPaid: false, autoPayHold: false, date: today },
    });
  });

  it("a new record keeps the date the user entered", () => {
    const created: StatusEntry = {
      kind: "credit",
      bucket: "daily",
      status: null,
      ruleId: null,
      period: null,
      date: "2026-11-02",
    };
    assert.deepEqual(statusPatch(created, "settled", { ...context, ruleDay: null }), {
      ok: true,
      patch: { status: "settled", settledAt: now, autoPaid: false, autoPayHold: false },
    });
    assert.equal(statusPatch({ ...bill, status: null }, "saved", context).ok, true);
  });

  it("reopening inside the cycle does not hold", () => {
    assert.deepEqual(statusPatch({ ...bill, status: "settled" }, "pending", context), {
      ok: true,
      patch: { status: "pending", savedAt: null, settledAt: null, autoPaid: false, autoPayHold: false },
    });
  });

  it("reopening past the cycle holds, on the renewal day too", () => {
    const old = { ...bill, status: "settled" as const, period: "2026-10", date: "2026-10-05" };
    const past = statusPatch(old, "pending", context);
    assert.ok(past.ok);
    assert.equal(past.patch.autoPayHold, true);

    const onRenewal = statusPatch(
      { ...old, date: "2026-10-10" },
      "pending",
      { ...context, ruleDay: 10 },
    );
    assert.ok(onRenewal.ok);
    assert.equal(onRenewal.patch.autoPayHold, true);
  });

  it("a held reopen is not auto-paid by the next sync", () => {
    const old = { ...bill, status: "settled" as const, period: "2026-10", date: "2026-10-05" };
    const reopened = statusPatch(old, "pending", context);
    assert.ok(reopened.ok);
    const plan = planRuleSync(
      rule({ autoPay: true, startsOn: "2026-10-05" }),
      [
        { id: "2026-10", period: "2026-10", status: reopened.patch.status, autoPayHold: reopened.patch.autoPayHold ?? false },
        record("2026-11"),
      ],
      [],
      today,
    );
    assert.deepEqual(plan, EMPTY_PLAN);
  });

  it("reopening a non-rule debit never holds and returns to the pipeline", () => {
    const invoice: StatusEntry = {
      kind: "debit",
      bucket: "wallet",
      status: "settled",
      ruleId: null,
      period: null,
      date: "2020-01-01",
    };
    assert.deepEqual(statusPatch(invoice, "pending", { ...context, ruleDay: null }), {
      ok: true,
      patch: {
        status: "pending",
        savedAt: null,
        settledAt: null,
        autoPaid: false,
        autoPayHold: false,
        bucket: "pending",
      },
    });
  });

  it("rejects planned on a rule record and allows it elsewhere", () => {
    assert.deepEqual(statusPatch(bill, "planned", context), {
      ok: false,
      errorKey: "validation.plannedNotForBills",
    });
    const lead: StatusEntry = {
      kind: "debit",
      bucket: "pending",
      status: "pending",
      ruleId: null,
      period: null,
      date: "2026-11-01",
    };
    assert.deepEqual(statusPatch(lead, "planned", { ...context, ruleDay: null }), {
      ok: true,
      patch: {
        status: "planned",
        savedAt: null,
        settledAt: null,
        autoPaid: false,
        autoPayHold: false,
        bucket: "potential",
      },
    });
  });

  it("setting the current status again keeps every timestamp", () => {
    assert.deepEqual(statusPatch({ ...bill, status: "saved" }, "saved", context), {
      ok: true,
      patch: { status: "saved" },
    });
    assert.deepEqual(statusPatch({ ...bill, status: "settled" }, "settled", context), {
      ok: true,
      patch: { status: "settled" },
    });
  });

  it("setting the current status again does not get past the saved guard", () => {
    const needsBill = { ok: false, errorKey: "validation.savedNeedsBill" };
    const saved = { ...bill, status: "saved" as const };
    assert.deepEqual(statusPatch({ ...saved, ruleId: null }, "saved", { ...context, ruleDay: null }), needsBill);
    assert.deepEqual(statusPatch({ ...saved, kind: "debit", bucket: "pending" }, "saved", context), needsBill);
    assert.deepEqual(statusPatch({ ...saved, bucket: "daily" }, "saved", context), needsBill);
    assert.deepEqual(statusPatch(saved, "saved", { ...context, ruleDay: null }), needsBill);
    assert.deepEqual(statusPatch({ ...saved, period: "2026-10", date: "2026-10-05" }, "saved", context), {
      ok: false,
      errorKey: "validation.savedCycleOver",
    });
  });

  it("setting the current status again does not get past the planned guard", () => {
    assert.deepEqual(statusPatch({ ...bill, status: "planned" }, "planned", context), {
      ok: false,
      errorKey: "validation.plannedNotForBills",
    });
  });

  it("only one record of a rule goes in savings", () => {
    const withOther = { ...context, otherSaved: true };
    assert.deepEqual(statusPatch(bill, "saved", withOther), { ok: false, errorKey: "validation.savedOtherMonth" });
    assert.deepEqual(statusPatch({ ...bill, status: "settled" }, "saved", withOther), {
      ok: false,
      errorKey: "validation.savedOtherMonth",
    });
    assert.equal(statusPatch(bill, "settled", withOther).ok, true);
    assert.equal(statusPatch(bill, "saved", { ...context, otherSaved: false }).ok, true);

    const late = { ...bill, period: "2026-10", date: "2026-10-05" };
    assert.deepEqual(statusPatch(late, "saved", withOther), { ok: false, errorKey: "validation.savedCycleOver" });
  });
});

describe("firstRecordDate", () => {
  it("keeps a date inside the running cycle", () => {
    assert.equal(firstRecordDate("2026-11-05", "2026-11-10"), "2026-11-05");
    assert.equal(firstRecordDate("2026-10-20", "2026-11-10"), "2026-10-20");
    assert.equal(firstRecordDate("2026-10-05", "2026-11-01"), "2026-10-05");
  });

  it("keeps a future date", () => {
    assert.equal(firstRecordDate("2026-11-25", "2026-11-10"), "2026-11-25");
    assert.equal(firstRecordDate("2027-02-10", "2026-11-10"), "2027-02-10");
  });

  it("moves an older date to this month", () => {
    assert.equal(firstRecordDate("2026-09-05", "2026-11-10"), "2026-11-05");
    assert.equal(firstRecordDate("2026-09-20", "2026-11-10"), "2026-11-20");
    assert.equal(firstRecordDate("2020-03-31", "2026-11-10"), "2026-11-30");
  });

  it("the record it picks is never late", () => {
    for (const entered of ["2024-01-05", "2026-03-31", "2026-10-15", "2026-10-28", "2026-10-30", "2026-11-01"]) {
      for (let today = "2026-10-01"; today < "2027-03-01"; today = addDays(today, 1)) {
        const date = firstRecordDate(entered, today);
        const phase = billPhase(periodOf(date), dayOfDate(date), today);
        assert.notEqual(phase, "late", `${entered} on ${today} picked ${date}`);
      }
    }
  });
});

describe("planAdoption", () => {
  const today = "2026-11-10";
  const created = new Date("2026-01-01T00:00:00Z");
  const ruleIdFor = (title: string) => `new:${title}`;

  function entry(id: string, overrides: Partial<AdoptionEntry> = {}): AdoptionEntry {
    return {
      id,
      kind: "credit",
      bucket: "fixed",
      status: "settled",
      title: "Rent",
      amount: 800,
      date: "2026-11-05",
      categoryId: "cat",
      note: null,
      ruleId: null,
      period: null,
      createdAt: created,
      updatedAt: created,
      ...overrides,
    };
  }

  const existing: AdoptionRule = { id: "rule-1", title: "Rent", isActive: true, startsOn: "2026-06-05" };

  it("creates a rule from the latest entry, off and marked as adopted", () => {
    const plan = planAdoption(
      {
        entries: [
          entry("old", { date: "2026-10-05", amount: 750, title: "rent " }),
          entry("new", { date: "2026-11-07", amount: 800, title: "Rent", note: "flat" }),
        ],
        rules: [],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan.newRules, [
      {
        id: "new:rent",
        title: "Rent",
        amount: 800,
        categoryId: "cat",
        note: "flat",
        dayOfMonth: 7,
        startsOn: "2026-11-07",
        autoPay: false,
        source: "adoption",
      },
    ]);
    assert.deepEqual(plan.links, [
      { entryId: "old", ruleId: "new:rent", period: "2026-10", toPending: false },
      { entryId: "new", ruleId: "new:rent", period: "2026-11", toPending: false },
    ]);
  });

  it("only adopts groups seen this month, last month or later", () => {
    const input = (date: string) => ({ entries: [entry("a", { date })], rules: [], ruleIdFor });
    assert.equal(planAdoption(input("2026-11-01"), today).newRules.length, 1);
    assert.equal(planAdoption(input("2026-10-01"), today).newRules.length, 1);
    assert.equal(planAdoption(input("2027-03-01"), today).newRules.length, 1);
    assert.deepEqual(planAdoption(input("2026-09-30"), today), {
      newRules: [],
      links: [],
      promote: [],
      deleteFuture: [],
    });
  });

  it("an old entry joins when the same title is still alive", () => {
    const plan = planAdoption(
      { entries: [entry("old", { date: "2025-01-05" }), entry("new", { date: "2026-10-05" })], rules: [], ruleIdFor },
      today,
    );
    assert.deepEqual(plan.links.map((link) => link.entryId).sort(), ["new", "old"]);
  });

  it("excludes non-candidates", () => {
    const plan = planAdoption(
      {
        entries: [
          entry("orphan", { period: "2026-11" }),
          entry("daily", { bucket: "daily" }),
          entry("debit", { kind: "debit", bucket: "wallet" }),
        ],
        rules: [],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan, { newRules: [], links: [], promote: [], deleteFuture: [] });
  });

  it("links to an existing rule with the same title, even a paused one, and creates none", () => {
    const paused = { ...existing, isActive: false };
    for (const candidate of [existing, paused]) {
      const plan = planAdoption(
        { entries: [entry("a", { title: "  RENT " })], rules: [candidate], ruleIdFor },
        today,
      );
      assert.deepEqual(plan.newRules, []);
      assert.deepEqual(plan.links, [{ entryId: "a", ruleId: "rule-1", period: "2026-11", toPending: false }]);
    }
  });

  it("prefers an active rule over a paused one with the same title", () => {
    const paused = { ...existing, id: "rule-0", isActive: false };
    const plan = planAdoption({ entries: [entry("a")], rules: [paused, existing], ruleIdFor }, today);
    assert.equal(plan.links[0].ruleId, "rule-1");
  });

  it("in a month picks settled over saved over pending over planned, and leaves the rest", () => {
    const plan = planAdoption(
      {
        entries: [
          entry("planned", { status: "planned", date: "2026-11-01" }),
          entry("pending", { status: "pending", date: "2026-11-02" }),
          entry("saved", { status: "saved", date: "2026-11-03" }),
          entry("settled", { status: "settled", date: "2026-11-04" }),
          entry("october-planned", { status: "planned", date: "2026-10-04" }),
          entry("october-pending", { status: "pending", date: "2026-10-05" }),
        ],
        rules: [],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan.links.map((link) => link.entryId).sort(), ["october-pending", "settled"]);
  });

  it("a linked planned entry becomes pending", () => {
    const plan = planAdoption({ entries: [entry("a", { status: "planned" })], rules: [], ruleIdFor }, today);
    assert.deepEqual(plan.links, [{ entryId: "a", ruleId: "new:rent", period: "2026-11", toPending: true }]);
  });

  it("does not link into a month the rule already holds", () => {
    const plan = planAdoption(
      {
        entries: [
          entry("linked", { ruleId: "rule-1", period: "2026-11", status: "pending" }),
          entry("taken", { date: "2026-11-02" }),
          entry("free", { date: "2026-10-02" }),
        ],
        rules: [existing],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan.links, [{ entryId: "free", ruleId: "rule-1", period: "2026-10", toPending: false }]);
  });

  it("promotes existing rule-linked planned records", () => {
    const plan = planAdoption(
      {
        entries: [
          entry("planned", { ruleId: "rule-1", period: "2026-10", status: "planned" }),
          entry("pending", { ruleId: "rule-1", period: "2026-11", status: "pending" }),
        ],
        rules: [existing],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan.promote, ["planned"]);
  });

  it("promotes a rule-linked planned record that has no period", () => {
    const plan = planAdoption(
      {
        entries: [entry("planned", { ruleId: "rule-1", period: null, status: "planned" })],
        rules: [existing],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan.promote, ["planned"]);
  });

  it("deletes only untouched pending records browsed into the future", () => {
    const touched = new Date("2026-02-01T00:00:00Z");
    const linked = (id: string, period: string, overrides: Partial<AdoptionEntry> = {}) =>
      entry(id, { ruleId: "rule-1", period, status: "pending", date: `${period}-05`, ...overrides });
    const plan = planAdoption(
      {
        entries: [
          linked("browsed", "2026-12"),
          linked("browsed-far", "2027-06"),
          linked("edited", "2027-01", { updatedAt: touched }),
          linked("paid", "2027-02", { status: "settled" }),
          linked("current", "2026-11"),
          linked("past", "2026-10"),
          linked("no-rule", "2027-03", { ruleId: "gone" }),
        ],
        rules: [existing],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan.deleteFuture.sort(), ["browsed", "browsed-far"]);
  });

  it("keeps a future record in the month the rule starts", () => {
    const futureRule = { ...existing, startsOn: "2027-02-05" };
    const plan = planAdoption(
      {
        entries: [entry("start", { ruleId: "rule-1", period: "2027-02", status: "pending", date: "2027-02-05" })],
        rules: [futureRule],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan.deleteFuture, []);
  });

  it("never links into a slot held by a record it is deleting", () => {
    const plan = planAdoption(
      {
        entries: [
          entry("browsed", { ruleId: "rule-1", period: "2026-12", status: "pending", date: "2026-12-05" }),
          entry("candidate", { date: "2026-12-05" }),
        ],
        rules: [existing],
        ruleIdFor,
      },
      today,
    );
    assert.deepEqual(plan.deleteFuture, ["browsed"]);
    assert.deepEqual(plan.links, []);
  });

  it("is deterministic whatever order the rows arrive in", () => {
    const entries = [
      entry("a", { date: "2026-11-05", status: "pending" }),
      entry("b", { date: "2026-11-05", status: "pending" }),
      entry("c", { date: "2026-11-05", status: "pending", amount: 900, title: "RENT" }),
      entry("d", { date: "2026-10-05" }),
    ];
    const forward = planAdoption({ entries, rules: [], ruleIdFor }, today);
    const backward = planAdoption({ entries: [...entries].reverse(), rules: [], ruleIdFor }, today);
    assert.deepEqual(forward.newRules, backward.newRules);
    assert.deepEqual(
      [...forward.links].sort((x, y) => x.period.localeCompare(y.period)),
      [...backward.links].sort((x, y) => x.period.localeCompare(y.period)),
    );
  });

  it("settles nothing, so no balance can change", () => {
    const plan = planAdoption(
      {
        entries: [
          entry("a", { status: "pending" }),
          entry("b", { status: "planned", date: "2026-10-05" }),
          entry("c", { ruleId: "rule-2", period: "2026-08", status: "planned", date: "2026-08-05" }),
        ],
        rules: [{ ...existing, id: "rule-2", title: "Water" }],
        ruleIdFor,
      },
      today,
    );
    const pendingIds = new Set(plan.links.filter((link) => link.toPending).map((link) => link.entryId));
    assert.deepEqual([...pendingIds], ["b"]);
    assert.deepEqual(plan.promote, ["c"]);
  });

  it("converges: once the plan is applied, adopting again changes nothing", () => {
    const entries = [
      entry("a", { date: "2026-11-05" }),
      entry("b", { date: "2026-11-06", status: "pending" }),
      entry("c", { date: "2026-10-05", status: "planned" }),
    ];
    const first = planAdoption({ entries, rules: [], ruleIdFor }, today);
    const rules: AdoptionRule[] = first.newRules.map((item) => ({
      id: item.id,
      title: item.title,
      isActive: true,
      startsOn: item.startsOn,
    }));
    const applied = entries.map((item) => {
      const link = first.links.find((candidate) => candidate.entryId === item.id);
      return link
        ? { ...item, ruleId: link.ruleId, period: link.period, status: link.toPending ? ("pending" as const) : item.status }
        : item;
    });
    const second = planAdoption({ entries: applied, rules, ruleIdFor }, today);
    assert.deepEqual(second.newRules, []);
    assert.deepEqual(second.promote, []);
    assert.deepEqual(second.deleteFuture, []);
    assert.deepEqual(second.links, []);
  });
});

describe("identifiers", () => {
  it("normalizes titles by case and outer whitespace only", () => {
    assert.equal(normalizeTitle("  Rent  "), "rent");
    assert.equal(normalizeTitle("LOYER Été"), "loyer été");
    assert.equal(normalizeTitle("Car  loan"), "car  loan");
  });

  it("gives an adopted rule the same id whatever the run, and another id per user and title", () => {
    const ruleIdFor = (userId: string) => (title: string) =>
      uuidFromHex(createHash("sha256").update(`adopt:${userId}:${title}`).digest("hex"));
    const stamp = new Date("2026-01-01T00:00:00Z");
    const entries: AdoptionEntry[] = ["a", "b"].map((id) => ({
      id,
      kind: "credit",
      bucket: "fixed",
      status: "pending",
      title: id === "a" ? "Rent" : " RENT ",
      amount: 800,
      date: "2026-11-05",
      categoryId: null,
      note: null,
      ruleId: null,
      period: null,
      createdAt: stamp,
      updatedAt: stamp,
    }));
    const adoptedId = (userId: string, rows: AdoptionEntry[]) =>
      planAdoption({ entries: rows, rules: [], ruleIdFor: ruleIdFor(userId) }, "2026-11-10").newRules[0].id;

    assert.equal(adoptedId("user-1", entries), adoptedId("user-1", [...entries].reverse()));
    assert.notEqual(adoptedId("user-1", entries), adoptedId("user-2", entries));
    assert.notEqual(ruleIdFor("user-1")("rent"), ruleIdFor("user-1")("gym"));
  });

  it("formats a digest as a UUID that passes strict validation", () => {
    const strict = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const hex of ["0".repeat(64), "f".repeat(64), "0123456789abcdef".repeat(4)]) {
      assert.match(uuidFromHex(hex), strict);
    }
    assert.equal(uuidFromHex("0123456789abcdef".repeat(4)), "01234567-89ab-8def-8123-456789abcdef");
  });
});

describe("nextFullOccurrence", () => {
  it("is the next month when that month has the day", () => {
    assert.equal(nextFullOccurrence("2026-10", 5), "2026-11-05");
    assert.equal(nextFullOccurrence("2026-12", 31), "2027-01-31");
  });

  it("walks past a month too short for the day, so the day never changes", () => {
    assert.equal(nextFullOccurrence("2026-01", 30), "2026-03-30");
    assert.equal(nextFullOccurrence("2026-10", 31), "2026-12-31");
    assert.equal(nextFullOccurrence("2027-01", 29), "2027-03-29");
    assert.equal(nextFullOccurrence("2028-01", 29), "2028-02-29");
  });
});

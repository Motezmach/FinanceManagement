import assert from "node:assert/strict";
import { test } from "node:test";
import ar from "./ar.json";
import en from "./en.json";
import fr from "./fr.json";

type Messages = { [key: string]: string | Messages };
type Argument = { name: string; type: string | null; selectors: string[] };

const locales: Record<string, Messages> = { en, fr, ar };
const ARABIC_PLURAL_FORMS = ["=0", "=1", "=2", "few", "many", "other"];

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const flat = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === "string") flat.set(`${prefix}${key}`, value);
    else for (const [path, text] of flatten(value, `${prefix}${key}.`)) flat.set(path, text);
  }
  return flat;
}

function closingBrace(text: string, open: number) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return i;
  }
  throw new Error(`Unbalanced braces in: ${text}`);
}

/** Collects every ICU argument, walking into plural and select branches. */
function icuArguments(message: string, found: Argument[] = []): Argument[] {
  for (let open = message.indexOf("{"); open !== -1; open = message.indexOf("{", open)) {
    const close = closingBrace(message, open);
    const body = message.slice(open + 1, close);
    open = close + 1;

    const [name, type = null] = body.split(",", 2).map((part) => part.trim());
    const argument: Argument = { name, type, selectors: [] };
    found.push(argument);
    if (type !== "plural" && type !== "selectordinal" && type !== "select") continue;

    let rest = body.slice(body.indexOf(",", body.indexOf(",") + 1) + 1);
    for (let branch = rest.indexOf("{"); branch !== -1; branch = rest.indexOf("{")) {
      const end = closingBrace(rest, branch);
      argument.selectors.push(rest.slice(0, branch).trim());
      icuArguments(rest.slice(branch + 1, end), found);
      rest = rest.slice(end + 1);
    }
  }
  return found;
}

function placeholders(message: string) {
  const tags = [...message.matchAll(/<(\w+)>/g)].map((match) => `<${match[1]}>`);
  const names = icuArguments(message).map((argument) => argument.name);
  return [...new Set([...names, ...tags])].sort();
}

const flatEn = flatten(en);

test("every locale has the same keys", () => {
  for (const [locale, messages] of Object.entries(locales)) {
    assert.deepEqual([...flatten(messages).keys()].sort(), [...flatEn.keys()].sort(), `keys of ${locale}`);
  }
});

test("every locale uses the same placeholders for a key", () => {
  for (const [locale, messages] of Object.entries(locales)) {
    for (const [key, message] of flatten(messages)) {
      const reference = flatEn.get(key);
      if (reference === undefined) continue;
      assert.deepEqual(placeholders(message), placeholders(reference), `${locale} ${key}`);
    }
  }
});

test("Arabic count plurals have all six forms", () => {
  for (const [key, message] of flatten(ar)) {
    for (const argument of icuArguments(message)) {
      if (argument.name !== "count" || argument.type !== "plural") continue;
      assert.deepEqual([...argument.selectors].sort(), [...ARABIC_PLURAL_FORMS].sort(), key);
    }
  }
});

test("French never escapes a placeholder or tag with a straight apostrophe", () => {
  for (const [key, message] of flatten(fr)) {
    assert.doesNotMatch(message, /'[{<]/, key);
  }
});

test("the placeholder scanner reads nested plurals and tags", () => {
  const message = "{name}: <b>{count, plural, =1 {one {thing}} other {# items}}</b> {day, selectordinal, one {#st} other {#th}}";
  assert.deepEqual(placeholders(message), ["<b>", "count", "day", "name", "thing"]);
  const count = icuArguments(message).find((argument) => argument.name === "count");
  assert.deepEqual(count?.selectors, ["=1", "other"]);
});

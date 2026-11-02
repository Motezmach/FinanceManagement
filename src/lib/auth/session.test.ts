import { test } from "node:test";
import assert from "node:assert/strict";

test("clearing a production cookie sends what its __Host- prefix requires", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  const { SESSION_COOKIE, TWO_FACTOR_COOKIE, clearedCookieOptions } = await import("./session");

  assert.ok(SESSION_COOKIE.startsWith("__Host-"));
  assert.ok(TWO_FACTOR_COOKIE.startsWith("__Host-"));

  const options = clearedCookieOptions();
  assert.equal(options.secure, true);
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, 0);
});

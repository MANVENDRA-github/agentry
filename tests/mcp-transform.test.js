import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateServer,
  toMcpServersJson,
  toOpenCodeMcpConfig,
} from "../scripts/mcp-transform.js";

// --- validateServer -------------------------------------------------------

test("validateServer accepts a stdio server with command and args", () => {
  const def = { command: "npx", args: ["-y", "@scope/server"] };
  assert.deepStrictEqual(validateServer(def), []);
});

test("validateServer accepts a remote server with a url", () => {
  const def = { type: "http", url: "https://example.com/mcp" };
  assert.deepStrictEqual(validateServer(def), []);
});

test("validateServer accepts a command server with an env object", () => {
  const def = { command: "server", env: { API_KEY: "x" } };
  assert.deepStrictEqual(validateServer(def), []);
});

test("validateServer rejects a server with neither command nor url", () => {
  const errors = validateServer({ args: ["x"] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /command.*stdio.*url.*remote/);
});

test("validateServer rejects an empty command string", () => {
  const errors = validateServer({ command: "" });
  assert.match(errors[0], /command/);
});

test("validateServer rejects a non-array args", () => {
  const errors = validateServer({ command: "x", args: "not-an-array" });
  assert.ok(errors.some((e) => /'args' must be an array/.test(e)));
});

test("validateServer rejects a non-object env", () => {
  const errors = validateServer({ command: "x", env: ["KEY=val"] });
  assert.ok(errors.some((e) => /'env' must be an object/.test(e)));
});

test("validateServer reports multiple problems at once", () => {
  const errors = validateServer({ args: "bad", env: 3 });
  // missing transport + bad args + bad env
  assert.equal(errors.length, 3);
});

test("validateServer rejects null", () => {
  assert.deepStrictEqual(validateServer(null), ["not a JSON object"]);
});

test("validateServer rejects an array", () => {
  assert.deepStrictEqual(validateServer([{ command: "x" }]), ["not a JSON object"]);
});

test("validateServer rejects a primitive", () => {
  assert.deepStrictEqual(validateServer("npx"), ["not a JSON object"]);
});

// --- toMcpServersJson ------------------------------------------------------

test("toMcpServersJson wraps servers under an mcpServers key", () => {
  const out = toMcpServersJson([{ name: "fs", def: { command: "npx" } }]);
  const parsed = JSON.parse(out);
  assert.deepStrictEqual(parsed, { mcpServers: { fs: { command: "npx" } } });
});

test("toMcpServersJson preserves the full server definition verbatim", () => {
  const def = { type: "http", url: "https://example.com/mcp", headers: { A: "b" } };
  const out = toMcpServersJson([{ name: "remote", def }]);
  assert.deepStrictEqual(JSON.parse(out).mcpServers.remote, def);
});

test("toMcpServersJson sorts servers by name for deterministic output", () => {
  const out = toMcpServersJson([
    { name: "zebra", def: { command: "z" } },
    { name: "alpha", def: { command: "a" } },
    { name: "mango", def: { command: "m" } },
  ]);
  assert.deepStrictEqual(Object.keys(JSON.parse(out).mcpServers), [
    "alpha",
    "mango",
    "zebra",
  ]);
});

test("toMcpServersJson output is independent of input order", () => {
  const a = toMcpServersJson([
    { name: "one", def: { command: "1" } },
    { name: "two", def: { command: "2" } },
  ]);
  const b = toMcpServersJson([
    { name: "two", def: { command: "2" } },
    { name: "one", def: { command: "1" } },
  ]);
  assert.equal(a, b);
});

test("toMcpServersJson does not mutate the caller's array", () => {
  const servers = [
    { name: "b", def: { command: "b" } },
    { name: "a", def: { command: "a" } },
  ];
  toMcpServersJson(servers);
  assert.equal(servers[0].name, "b", "input array order should be unchanged");
});

test("toMcpServersJson pretty-prints with 2-space indent and a trailing newline", () => {
  const out = toMcpServersJson([{ name: "fs", def: { command: "npx" } }]);
  assert.ok(out.endsWith("\n"), "should end with a newline");
  assert.match(out, /\n {2}"mcpServers"/);
});

test("toMcpServersJson on an empty list produces an empty mcpServers map", () => {
  assert.equal(toMcpServersJson([]), '{\n  "mcpServers": {}\n}\n');
});

// --- toOpenCodeMcpConfig ---------------------------------------------------

test("toOpenCodeMcpConfig wraps servers under $schema + mcp", () => {
  const out = JSON.parse(toOpenCodeMcpConfig([{ name: "fs", def: { command: "npx" } }]));
  assert.equal(out.$schema, "https://opencode.ai/config.json");
  assert.ok(out.mcp.fs, "server should be under the mcp key");
});

test("toOpenCodeMcpConfig maps a stdio server to type local with a command array", () => {
  const out = JSON.parse(
    toOpenCodeMcpConfig([
      { name: "fs", def: { command: "npx", args: ["-y", "@scope/server"] } },
    ]),
  );
  assert.deepStrictEqual(out.mcp.fs, {
    type: "local",
    command: ["npx", "-y", "@scope/server"],
    enabled: true,
  });
});

test("toOpenCodeMcpConfig folds env into the OpenCode 'environment' key", () => {
  const out = JSON.parse(
    toOpenCodeMcpConfig([{ name: "s", def: { command: "srv", env: { API_KEY: "x" } } }]),
  );
  assert.deepStrictEqual(out.mcp.s.environment, { API_KEY: "x" });
});

test("toOpenCodeMcpConfig handles a command with no args (command array of one)", () => {
  const out = JSON.parse(toOpenCodeMcpConfig([{ name: "s", def: { command: "srv" } }]));
  assert.deepStrictEqual(out.mcp.s.command, ["srv"]);
});

test("toOpenCodeMcpConfig maps a remote server to type remote with url + headers", () => {
  const out = JSON.parse(
    toOpenCodeMcpConfig([
      { name: "r", def: { type: "http", url: "https://x/mcp", headers: { A: "b" } } },
    ]),
  );
  assert.deepStrictEqual(out.mcp.r, {
    type: "remote",
    url: "https://x/mcp",
    enabled: true,
    headers: { A: "b" },
  });
});

test("toOpenCodeMcpConfig sorts servers by name for deterministic output", () => {
  const out = JSON.parse(
    toOpenCodeMcpConfig([
      { name: "zebra", def: { command: "z" } },
      { name: "alpha", def: { command: "a" } },
    ]),
  );
  assert.deepStrictEqual(Object.keys(out.mcp), ["alpha", "zebra"]);
});

test("toOpenCodeMcpConfig ends with a trailing newline", () => {
  assert.ok(toOpenCodeMcpConfig([{ name: "s", def: { command: "x" } }]).endsWith("\n"));
});

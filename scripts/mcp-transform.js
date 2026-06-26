// agentry — MCP adapter transforms.
//
// Source of truth: one JSON file per server at mcp/<name>.json. Each file is
// the server *definition* object exactly as it appears inside an `mcpServers`
// map — for a local server:
//
//   { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-foo"],
//     "env": { "API_KEY": "..." } }
//
// or for a remote server:
//
//   { "type": "http", "url": "https://example.com/mcp" }
//
// The server's name is its filename: mcp/github.json -> "github". This mirrors
// how agents and skills take their identity from the filename rather than a
// frontmatter field — MCP definitions have no name field of their own, the
// name is the map key.
//
// Claude Code and Cursor both consume an `mcpServers` map (Claude from
// .mcp.json at the project root, Cursor from .cursor/mcp.json), so one builder
// serves both. Codex stores servers as TOML under [mcp_servers.<name>] inside
// its shared config.toml and is deferred — see docs/decisions.md D20.

/**
 * Validate a parsed server definition. Returns an array of error strings
 * (empty if valid). A server must be a JSON object that declares either a
 * `command` (stdio transport) or a `url` (remote transport).
 *
 * This is the semantic check used by lint and doctor. The sync engine does not
 * call it — sync only needs the JSON to parse — so an invalid-but-parseable
 * server still syncs, and lint is what fails the build.
 *
 * @param {unknown} def - The parsed contents of an mcp/<name>.json file.
 * @returns {string[]} One message per problem; empty array if valid.
 */
export function validateServer(def) {
  if (def === null || typeof def !== "object" || Array.isArray(def)) {
    return ["not a JSON object"];
  }
  const errors = [];
  const hasCommand = typeof def.command === "string" && def.command.length > 0;
  const hasUrl = typeof def.url === "string" && def.url.length > 0;
  if (!hasCommand && !hasUrl) {
    errors.push("must declare a non-empty 'command' (stdio) or 'url' (remote)");
  }
  if (def.args !== undefined && !Array.isArray(def.args)) {
    errors.push("'args' must be an array");
  }
  if (
    def.env !== undefined &&
    (typeof def.env !== "object" || def.env === null || Array.isArray(def.env))
  ) {
    errors.push("'env' must be an object");
  }
  return errors;
}

/**
 * Build the `{ "mcpServers": { <name>: def, ... } }` config that both Claude
 * Code (.mcp.json) and Cursor (.cursor/mcp.json) read.
 *
 * Servers are sorted by name so the output is byte-identical regardless of the
 * order `readdir` returns the source files — the same idempotence the rest of
 * the sync engine depends on for CI's clean-tree check.
 *
 * @param {Array<{ name: string, def: object }>} servers
 * @returns {string} Pretty-printed JSON with a trailing newline (plugin.json style).
 */
export function toMcpServersJson(servers) {
  const sorted = [...servers].sort((a, b) => a.name.localeCompare(b.name));
  const mcpServers = {};
  for (const { name, def } of sorted) {
    mcpServers[name] = def;
  }
  return JSON.stringify({ mcpServers }, null, 2) + "\n";
}

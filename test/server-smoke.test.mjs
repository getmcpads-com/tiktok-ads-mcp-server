import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, "..", "..");
const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
const localTsxBin = path.join(repoRoot, "node_modules", ".bin", binName);
const workspaceTsxBin = path.join(workspaceRoot, "node_modules", ".bin", binName);
const tsxBin = fs.existsSync(localTsxBin) ? localTsxBin : workspaceTsxBin;

function cleanEnv(extra) {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === "string")),
    ...extra,
  };
}

test("TikTok Ads MCP exposes core tools and resources over stdio", async () => {
  const client = new Client({ name: "tiktok-ads-mcp-smoke", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: tsxBin,
    args: ["src/cli.ts"],
    cwd: repoRoot,
    env: cleanEnv({
      TIKTOK_ACCESS_TOKEN: "test-access-token",
      TIKTOK_APP_ID: "test-app-id",
      LOG_LEVEL: "error",
    }),
    stderr: "pipe",
  });

  try {
    await client.connect(transport, { timeout: 15000 });
    const tools = await client.listTools(undefined, { timeout: 15000 });
    const toolNames = tools.tools.map((tool) => tool.name);
    assert.equal(toolNames.length, 27);

    for (const name of [
      "tiktok_health_check",
      "tiktok_get_insights",
      "tiktok_validate_query",
      "tiktok_get_spark_organic_joins",
      "tiktok_get_entities_raw",
      "tiktok_get_report_raw",
      "tiktok_get_targeting_catalog",
      "tiktok_get_read_endpoint",
    ]) {
      assert.ok(toolNames.includes(name), `missing tool ${name}`);
    }

    const resources = await client.listResources(undefined, { timeout: 15000 });
    const resourceUris = resources.resources.map((resource) => resource.uri);

    for (const uri of [
      "tiktok://manifest",
      "tiktok://metrics",
      "tiktok://compatibility",
    ]) {
      assert.ok(resourceUris.includes(uri), `missing resource ${uri}`);
    }

    const manifest = await client.readResource({ uri: "tiktok://manifest" }, { timeout: 15000 });
    const manifestPayload = JSON.parse(manifest.contents[0].text);
    assert.equal(manifestPayload.tools.length, 27);
    assert.ok(manifestPayload.tools.some((tool) => tool.name === "tiktok_get_read_endpoint"));
  } finally {
    await transport.close().catch(() => undefined);
  }
});

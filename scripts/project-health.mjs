import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const reportPath = resolve(root, "PROJECT_HEALTH.md");
const envPath = resolve(root, ".env");

function readLocalEnv() {
  try {
    return Object.fromEntries(
      readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          return separator < 0 ? [line.trim(), ""] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 20 * 1024 * 1024 });
  return { code: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`.trim() };
}

function summarize(output) {
  return output.split(/\r?\n/).filter(Boolean).slice(-18).join("\n").slice(-3500);
}

function buildReport(results) {
  const now = new Date().toISOString();
  const passed = results.every((item) => item.code === 0);
  const lines = [
    "# SHAKH Project Health",
    "",
    `- Checked: ${now}`,
    `- Status: ${passed ? "PASS" : "FAIL"}`,
    "- Mode: report only; no source files were changed automatically.",
    "",
    "## Checks",
    "",
  ];
  for (const result of results) {
    lines.push(`### ${result.name}: ${result.code === 0 ? "PASS" : "FAIL"}`, "", "```text", summarize(result.output) || "No output", "```", "");
  }
  if (!passed) {
    lines.push("## Suggested Next Step", "", "Review the failing check output above, then prepare a focused patch. The bot intentionally does not edit application code automatically.", "");
  }
  return lines.join("\n");
}

async function notifyDiscord(webhookUrl, report, results) {
  if (!webhookUrl || /PASTE_YOUR|PASTE_DISCORD|YOUR_/.test(webhookUrl)) return "DISCORD_NOT_CONFIGURED";
  const failed = results.filter((item) => item.code !== 0).map((item) => item.name);
  const content = failed.length === 0
    ? "SHAKH health check PASS: typecheck and build completed."
    : `SHAKH health check FAIL: ${failed.join(", ")}. See PROJECT_HEALTH.md for the report.`;
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
    return response.ok ? "DISCORD_SENT" : `DISCORD_FAILED_${response.status}`;
  } catch {
    return "DISCORD_FAILED_NETWORK";
  }
}

async function main() {
  const results = [
    { name: "typecheck", ...run("npm", ["run", "typecheck"]) },
    { name: "build", ...run("npm", ["run", "build"]) },
  ];
  const report = buildReport(results);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, "utf8");
  const notification = await notifyDiscord(readLocalEnv().DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL, report, results);
  appendFileSync(reportPath, `\n- Discord notification: ${notification}\n`, "utf8");
  process.exitCode = results.every((item) => item.code === 0) ? 0 : 1;
}

main();

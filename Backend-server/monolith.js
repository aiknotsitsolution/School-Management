/**
 * monolith.js — Single-process launcher for all microservices.
 *
 * Starts every backend service + the API gateway as child processes, each on
 * its own internal port.  The gateway (port from GATEWAY_PORT / $PORT) is the
 * only externally exposed entry-point; all inter-service traffic stays on
 * localhost.
 *
 * Usage:
 *   node monolith.js            # production
 *   node monolith.js --verbose   # prints child stdout/stderr in real-time
 */

const { spawn } = require("child_process");
const dotenv = require("dotenv");
const http = require("http");
const net = require("net");
const path = require("path");

/* ── Configuration ──────────────────────────────────────────────────────── */

const root = path.resolve(__dirname);
dotenv.config({ path: path.join(root, ".env"), override: true });

// Render injects $PORT; gateway listens on it.  Internal services keep their
// own fixed ports so the gateway proxy targets stay stable.
const GATEWAY_PORT = Number(process.env.PORT || process.env.GATEWAY_PORT || 5000);

const services = [
  //  name              directory                          port  startCommand
  ["auth",             "services/auth-service",            5001, "npm start"],
  ["student",          "services/student-service",         5002, "npm start"],
  ["staff",            "services/staff-service",           5003, "npm start"],
  ["academic",         "services/academic-service",        5004, "npm start"],
  ["fee",              "services/fee-service",             5005, "npm start"],
  ["communication",    "services/communication-service",   5006, "npm start"],
  ["library",          "services/library-service",         5007, "npm start"],
  ["facility",         "services/facility-service",        5008, "npm start"],
];

// Gateway runs last; its port is $PORT (Render) or GATEWAY_PORT fallback.
const gateway = ["gateway", "api-gateway", GATEWAY_PORT, "npm start"];

const allServices = [...services, gateway];

const VERBOSE = process.argv.includes("--verbose");
const HEALTH_TIMEOUT_MS = 3000;
const STARTUP_POLL_MS = 2000;
const STARTUP_BUDGET_MS = 90_000;

/* ── Helpers ────────────────────────────────────────────────────────────── */

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error",   () => resolve(false));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/health", timeout: HEALTH_TIMEOUT_MS },
      (res) => { res.resume(); resolve(res.statusCode === 200); },
    );
    req.on("error",   () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function waitForHealthy(port, label, budgetMs = STARTUP_BUDGET_MS) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (await checkHealth(port)) return true;
    await new Promise((r) => setTimeout(r, STARTUP_POLL_MS));
  }
  console.error(`[monolith] ${label} did not become healthy within ${budgetMs}ms`);
  return false;
}

/* ── Process management ─────────────────────────────────────────────────── */

const children = [];
let shuttingDown = false;

function spawnService(name, directory, port, command) {
  const cwd = path.join(root, directory);
  const args = command.split(" ");
  const cmd = args.shift();

  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
  });

  const tag = `[${String(name).padEnd(13)}]`;

  if (VERBOSE) {
    child.stdout.on("data", (d) => process.stdout.write(`${tag} ${d}`));
    child.stderr.on("data", (d) => process.stderr.write(`${tag} ${d}`));
  } else {
    // Buffer output; only print on crash
    child._logTail = [];
    child.stdout.on("data", (d) => {
      const lines = d.toString().split("\n").filter(Boolean);
      child._logTail.push(...lines);
      if (child._logTail.length > 50) child._logTail.splice(0, child._logTail.length - 50);
    });
    child.stderr.on("data", (d) => {
      const lines = d.toString().split("\n").filter(Boolean);
      child._logTail.push(...lines);
      if (child._logTail.length > 50) child._logTail.splice(0, child._logTail.length - 50);
    });
  }

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`${tag} exited (${reason})`);
    if (!VERBOSE && child._logTail?.length) {
      console.error(`${tag} last log lines:`);
      child._logTail.forEach((l) => console.error(`  ${l}`));
    }
    // Don't auto-restart — let the process manager (Render / PM2) handle it
  });

  children.push(child);
  return child;
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[monolith] ${signal} received, shutting down…`);
  for (const child of children) {
    if (child.exitCode !== null) continue; // already dead
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
    } else {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/* ── Main ───────────────────────────────────────────────────────────────── */

async function main() {
  console.log("[monolith] Starting all services…\n");

  // 1. Spawn backend services (gateway first on the port list so its health
  //    endpoint is the one Render probes).
  //    Spawn in reverse order so the gateway starts last and proxies are ready
  //    by the time it begins accepting traffic.
  for (const [name, dir, port, cmd] of [...services].reverse()) {
    if (await isPortOpen(port)) {
      console.log(`[monolith] ${name} already running on :${port}`);
      continue;
    }
    console.log(`[monolith] starting ${name} on :${port}`);
    spawnService(name, dir, port, cmd);
  }

  // Give backend services a moment to bind their ports before starting gateway
  await new Promise((r) => setTimeout(r, 1500));

  // 2. Spawn gateway on the externally-visible port
  if (await isPortOpen(GATEWAY_PORT)) {
    console.log(`[monolith] gateway already running on :${GATEWAY_PORT}`);
  } else {
    console.log(`[monolith] starting gateway on :${GATEWAY_PORT}`);
    spawnService(...gateway);
  }

  // 3. Health-check polling
  console.log("\n[monolith] Waiting for services to become healthy…\n");
  const deadline = Date.now() + STARTUP_BUDGET_MS;
  let allHealthy = false;
  while (Date.now() < deadline) {
    const results = await Promise.all(
      allServices.map(async ([name, , port]) => ({
        name,
        port,
        ok: await checkHealth(port),
      })),
    );
    const unhealthy = results.filter((r) => !r.ok);
    if (unhealthy.length === 0) {
      allHealthy = true;
      break;
    }
    process.stdout.write(
      `\r[monolith] Waiting… ${results.length - unhealthy.length}/${results.length} healthy`,
    );
    await new Promise((r) => setTimeout(r, STARTUP_POLL_MS));
  }
  console.log("");

  if (allHealthy) {
    console.log("[monolith] All services healthy ✓");
  } else {
    console.error("[monolith] Some services failed to start within budget");
  }

  // Print final status table
  console.log("\n  Service             Port    Status");
  console.log("  ─────────────────── ─────── ────────");
  for (const [name, , port] of allServices) {
    const ok = await checkHealth(port);
    const pad = (s, n) => String(s).padEnd(n);
    console.log(`  ${pad(name, 20)} ${pad(port, 8)} ${ok ? "UP" : "DOWN"}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("[monolith] Fatal:", err);
  shutdown("error");
});

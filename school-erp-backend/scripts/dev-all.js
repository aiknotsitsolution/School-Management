const { spawn } = require("child_process");
const dotenv = require("dotenv");
const net = require("net");
const path = require("path");

const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, ".env"), override: true });
const services = [
  ["gateway", "api-gateway", 5000],
  ["auth", "services/auth-service", 5001],
  ["student", "services/student-service", 5002],
  ["staff", "services/staff-service", 5003],
  ["academic", "services/academic-service", 5004],
  ["fee", "services/fee-service", 5005],
  ["communication", "services/communication-service", 5006],
  ["library", "services/library-service", 5007],
  ["facility", "services/facility-service", 5008],
];

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

let children = [];
let shuttingDown = false;

async function startServices() {
  for (const [name, directory, port] of services) {
    if (await isPortOpen(port)) {
      console.log(`[${name}] already running on port ${port}`);
      continue;
    }

    const child = spawn("npm.cmd", ["run", "dev"], {
      cwd: path.join(root, directory),
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
      windowsHide: true,
    });

    const prefix = `[${name}]`;
    child.stdout.on("data", (data) =>
      process.stdout.write(`${prefix} ${data}`),
    );
    child.stderr.on("data", (data) =>
      process.stderr.write(`${prefix} ${data}`),
    );
    child.on("exit", (code) => {
      if (code && !shuttingDown) {
        console.error(`${prefix} exited with code ${code}`);
      }
    });
    children.push(child);
  }
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach((child) => {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
    } else {
      child.kill();
    }
  });
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log(
  "Starting all ERP services. Press Ctrl+C to stop services started by this command.",
);
startServices().catch((error) => {
  console.error(error);
  shutdown();
});

/**
 * Materio Monorepo - Parallel Development Server Runner
 * Starts accounts, auth, and admin app servers concurrently with prefixed, color-coded logs.
 */

interface ServiceConfig {
  name: string;
  tag: string;
  color: string;
  port: number;
  cmd: string[];
}

declare const Bun: {
  spawn: (
    cmd: string[],
    options?: {
      cwd?: string;
      env?: Record<string, string | undefined>;
      stdout?: "pipe" | "inherit" | "ignore";
      stderr?: "pipe" | "inherit" | "ignore";
    }
  ) => {
    pid: number;
    stdout: ReadableStream<Uint8Array> | null;
    stderr: ReadableStream<Uint8Array> | null;
    exited: Promise<number>;
    kill: (signal?: string) => void;
  };
  spawnSync: (
    cmd: string[],
    options?: {
      stdout?: "pipe" | "inherit" | "ignore";
      stderr?: "pipe" | "inherit" | "ignore";
    }
  ) => { exitCode: number };
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const services: ServiceConfig[] = [
  {
    name: "accounts",
    tag: "[accounts]",
    color: "\x1b[36m", // Cyan
    port: 5173,
    cmd: ["bun", "run", "dev:accounts"],
  },
  {
    name: "auth",
    tag: "[auth]    ",
    color: "\x1b[33m", // Yellow
    port: 5174,
    cmd: ["bun", "run", "dev:auth"],
  },
  {
    name: "admin",
    tag: "[admin]   ",
    color: "\x1b[35m", // Magenta
    port: 5175,
    cmd: ["bun", "run", "dev:admin"],
  },
];

console.log(`${BOLD}\x1b[32m🚀 Starting all 3 app servers in parallel...${RESET}\n`);
for (const s of services) {
  console.log(`  ${s.color}${BOLD}${s.tag}${RESET} http://localhost:${s.port}`);
}
console.log();

const spawned: ReturnType<typeof Bun.spawn>[] = [];
let isShuttingDown = false;

function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${BOLD}\x1b[31m Shutting down all servers...${RESET}`);

  for (const proc of spawned) {
    if (!proc) continue;
    try {
      if (process.platform === "win32" && proc.pid) {
        Bun.spawnSync(["taskkill", "/pid", String(proc.pid), "/T", "/F"], {
          stdout: "ignore",
          stderr: "ignore",
        });
      } else {
        proc.kill("SIGTERM");
      }
    } catch {
      // Ignore errors during teardown
    }
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => shutdown(0));

async function streamOutput(
  stream: ReadableStream<Uint8Array> | null,
  prefix: string,
  out: NodeJS.WriteStream
) {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        out.write(`${prefix} ${line}\n`);
      }
    }
    if (buffer.length > 0) {
      out.write(`${prefix} ${buffer}\n`);
    }
  } catch {
    // Stream closed or process terminated
  }
}

for (const s of services) {
  const prefix = `${s.color}${BOLD}${s.tag}${RESET}`;
  try {
    const proc = Bun.spawn(s.cmd, {
      cwd: process.cwd(),
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    });

    spawned.push(proc);

    streamOutput(proc.stdout, prefix, process.stdout);
    streamOutput(proc.stderr, prefix, process.stderr);

    proc.exited.then((code: number) => {
      if (!isShuttingDown && code !== 0) {
        console.error(`${prefix} \x1b[31mProcess exited with code ${code}${RESET}`);
      }
    });
  } catch (err) {
    console.error(`${prefix} \x1b[31mFailed to start:${RESET}`, err);
  }
}

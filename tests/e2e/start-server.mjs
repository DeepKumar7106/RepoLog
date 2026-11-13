import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const backupDirectory = join(process.cwd(), "test-results", ".playwright");

mkdirSync(backupDirectory, { recursive: true });

for (const file of ["next-env.d.ts", "tsconfig.json"]) {
  copyFileSync(join(process.cwd(), file), join(backupDirectory, file));
}

const nextBinary = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBinary, "dev", "-p", "3100"], {
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("error", () => {
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

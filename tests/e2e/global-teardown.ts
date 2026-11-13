import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const backupDirectory = join(process.cwd(), "test-results", ".playwright");

export default async function globalTeardown(): Promise<void> {
  for (const file of ["next-env.d.ts", "tsconfig.json"]) {
    const backup = join(backupDirectory, file);

    if (existsSync(backup)) {
      copyFileSync(backup, join(process.cwd(), file));
    }
  }
}

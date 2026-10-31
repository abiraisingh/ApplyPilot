import { rm } from "node:fs/promises";
import { resolve } from "node:path";

export default async function setup() {
  return async () => {
    await rm(resolve(process.cwd(), "prisma", "test.db"), { force: true });
  };
}

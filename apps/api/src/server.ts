import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./shared/prisma.js";
import { runScheduledGmailSync } from "./modules/integrations/gmail.service.js";

const server = app.listen(env.API_PORT, () => {
  console.log(`ApplyPilot API listening on http://localhost:${env.API_PORT}`);
});

const gmailSyncTimer = setInterval(() => {
  void runScheduledGmailSync();
}, env.GMAIL_SYNC_INTERVAL_MINUTES * 60 * 1000);
gmailSyncTimer.unref();

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down`);
  clearInterval(gmailSyncTimer);
  server.close(async (error) => {
    await prisma.$disconnect();
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

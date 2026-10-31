CREATE TABLE "EmailIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "EmailOAuthState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stateHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ImportedEmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportedEmailMessage_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "EmailIntegration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Application" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

CREATE UNIQUE INDEX "EmailIntegration_userId_key" ON "EmailIntegration"("userId");
CREATE UNIQUE INDEX "EmailOAuthState_stateHash_key" ON "EmailOAuthState"("stateHash");
CREATE INDEX "EmailOAuthState_expiresAt_idx" ON "EmailOAuthState"("expiresAt");
CREATE INDEX "ImportedEmailMessage_integrationId_createdAt_idx" ON "ImportedEmailMessage"("integrationId", "createdAt");
CREATE UNIQUE INDEX "ImportedEmailMessage_integrationId_messageId_key" ON "ImportedEmailMessage"("integrationId", "messageId");

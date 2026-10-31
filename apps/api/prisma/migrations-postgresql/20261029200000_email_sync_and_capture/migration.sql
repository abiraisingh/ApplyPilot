CREATE TABLE "EmailIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportedEmailMessage" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportedEmailMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Application" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

CREATE UNIQUE INDEX "EmailIntegration_userId_key" ON "EmailIntegration"("userId");
CREATE UNIQUE INDEX "EmailOAuthState_stateHash_key" ON "EmailOAuthState"("stateHash");
CREATE INDEX "EmailOAuthState_expiresAt_idx" ON "EmailOAuthState"("expiresAt");
CREATE INDEX "ImportedEmailMessage_integrationId_createdAt_idx" ON "ImportedEmailMessage"("integrationId", "createdAt");
CREATE UNIQUE INDEX "ImportedEmailMessage_integrationId_messageId_key" ON "ImportedEmailMessage"("integrationId", "messageId");

ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailOAuthState" ADD CONSTRAINT "EmailOAuthState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportedEmailMessage" ADD CONSTRAINT "ImportedEmailMessage_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "EmailIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

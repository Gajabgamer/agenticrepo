-- Turso/libSQL setup for the GitHub engineering agent platform.
-- Paste this into the Turso browser SQL editor for the target database.
-- made by bob

CREATE TABLE IF NOT EXISTS "GithubEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PullRequestAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prNumber" INTEGER NOT NULL,
    "repository" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubId" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "githubAccessToken" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bobApiKey" TEXT,
    "githubWebhookSecret" TEXT,
    "autoFixEnabled" BOOLEAN NOT NULL DEFAULT false,
    "confidenceThreshold" INTEGER NOT NULL DEFAULT 80,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "ConnectedRepository" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "cloneUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConnectedRepository_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_githubId_key" ON "User"("githubId");

CREATE UNIQUE INDEX IF NOT EXISTS "ConnectedRepository_userId_key" ON "ConnectedRepository"("userId");

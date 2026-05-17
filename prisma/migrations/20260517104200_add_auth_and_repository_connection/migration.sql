-- CreateTable
CREATE TABLE "User" (
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

-- CreateTable
CREATE TABLE "ConnectedRepository" (
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

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedRepository_userId_key" ON "ConnectedRepository"("userId");

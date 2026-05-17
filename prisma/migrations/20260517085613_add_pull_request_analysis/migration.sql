-- CreateTable
CREATE TABLE "PullRequestAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prNumber" INTEGER NOT NULL,
    "repository" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

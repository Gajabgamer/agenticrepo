-- made by bob
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investigationKey" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "currentStage" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "confidenceLevel" TEXT,
    "rootCause" TEXT,
    "affectedFiles" TEXT,
    "suspiciousCommits" TEXT,
    "conclusion" TEXT,
    "recommendedActions" TEXT,
    "linkedIncidentId" TEXT,
    "relatedWorkflow" TEXT,
    "relatedPr" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "InvestigationStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investigationId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "InvestigationStep_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Investigation_investigationKey_key" ON "Investigation"("investigationKey");
CREATE INDEX "Investigation_repository_idx" ON "Investigation"("repository");
CREATE INDEX "Investigation_status_idx" ON "Investigation"("status");
CREATE INDEX "Investigation_startedAt_idx" ON "Investigation"("startedAt");
CREATE INDEX "InvestigationStep_investigationId_idx" ON "InvestigationStep"("investigationId");
CREATE INDEX "InvestigationStep_startedAt_idx" ON "InvestigationStep"("startedAt");

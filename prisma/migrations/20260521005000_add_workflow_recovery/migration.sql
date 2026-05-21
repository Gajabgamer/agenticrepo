-- made by bob
CREATE TABLE "WorkflowRecovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recoveryKey" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "workflowName" TEXT,
    "branch" TEXT,
    "runId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "strategy" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "stabilizationProbability" INTEGER NOT NULL,
    "probableRootCause" TEXT NOT NULL,
    "affectedSystems" TEXT,
    "proposedRemediation" TEXT NOT NULL,
    "operationalImpact" TEXT NOT NULL,
    "validationSummary" TEXT NOT NULL,
    "autoFixEligible" BOOLEAN NOT NULL DEFAULT false,
    "autoFixExecuted" BOOLEAN NOT NULL DEFAULT false,
    "recoveryPullRequestUrl" TEXT,
    "linkedIncidentKey" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WorkflowRecoveryStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recoveryId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "WorkflowRecoveryStep_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "WorkflowRecovery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkflowRecovery_recoveryKey_key" ON "WorkflowRecovery"("recoveryKey");
CREATE INDEX "WorkflowRecovery_repository_idx" ON "WorkflowRecovery"("repository");
CREATE INDEX "WorkflowRecovery_status_idx" ON "WorkflowRecovery"("status");
CREATE INDEX "WorkflowRecovery_startedAt_idx" ON "WorkflowRecovery"("startedAt");
CREATE INDEX "WorkflowRecoveryStep_recoveryId_idx" ON "WorkflowRecoveryStep"("recoveryId");
CREATE INDEX "WorkflowRecoveryStep_startedAt_idx" ON "WorkflowRecoveryStep"("startedAt");

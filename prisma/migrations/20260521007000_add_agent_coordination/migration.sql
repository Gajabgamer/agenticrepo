-- made by bob
CREATE TABLE "AgentCoordinationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runKey" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "activeAgent" TEXT,
    "combinedConclusion" TEXT,
    "operationalSummary" TEXT,
    "linkedWorkflow" TEXT,
    "linkedIncidentKey" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "summary" TEXT NOT NULL,
    "context" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AgentTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentCoordinationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AgentFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "findingType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT,
    "confidence" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentCoordinationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AgentCoordinationRun_runKey_key" ON "AgentCoordinationRun"("runKey");
CREATE INDEX "AgentCoordinationRun_repository_idx" ON "AgentCoordinationRun"("repository");
CREATE INDEX "AgentCoordinationRun_status_idx" ON "AgentCoordinationRun"("status");
CREATE INDEX "AgentCoordinationRun_startedAt_idx" ON "AgentCoordinationRun"("startedAt");
CREATE INDEX "AgentTask_runId_idx" ON "AgentTask"("runId");
CREATE INDEX "AgentTask_agentType_idx" ON "AgentTask"("agentType");
CREATE INDEX "AgentTask_status_idx" ON "AgentTask"("status");
CREATE INDEX "AgentFinding_runId_idx" ON "AgentFinding"("runId");
CREATE INDEX "AgentFinding_agentType_idx" ON "AgentFinding"("agentType");
CREATE INDEX "AgentFinding_severity_idx" ON "AgentFinding"("severity");

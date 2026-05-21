-- made by bob
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "affectedBranch" TEXT,
    "affectedFiles" TEXT,
    "engineeringSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "relatedWorkflow" TEXT,
    "relatedPr" INTEGER,
    "relatedIssue" INTEGER,
    "relatedUrl" TEXT,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME
);

CREATE TABLE "IncidentHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentHistory_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RepositoryHealthSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repository" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "workflowFailures" INTEGER NOT NULL,
    "regressionIncidents" INTEGER NOT NULL,
    "failedPullRequests" INTEGER NOT NULL,
    "suspiciousCommits" INTEGER NOT NULL,
    "unresolvedIssues" INTEGER NOT NULL,
    "autoFixSuccesses" INTEGER NOT NULL,
    "autoFixFailures" INTEGER NOT NULL,
    "workflowReliability" INTEGER NOT NULL,
    "autoFixSuccessRate" INTEGER NOT NULL,
    "stabilityTrend" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_repository_idx" ON "ActivityEvent"("repository");
CREATE UNIQUE INDEX "Incident_incidentKey_key" ON "Incident"("incidentKey");
CREATE INDEX "Incident_repository_idx" ON "Incident"("repository");
CREATE INDEX "Incident_status_idx" ON "Incident"("status");
CREATE INDEX "Incident_openedAt_idx" ON "Incident"("openedAt");
CREATE INDEX "IncidentHistory_incidentId_idx" ON "IncidentHistory"("incidentId");
CREATE INDEX "IncidentHistory_createdAt_idx" ON "IncidentHistory"("createdAt");
CREATE INDEX "RepositoryHealthSnapshot_repository_idx" ON "RepositoryHealthSnapshot"("repository");
CREATE INDEX "RepositoryHealthSnapshot_createdAt_idx" ON "RepositoryHealthSnapshot"("createdAt");

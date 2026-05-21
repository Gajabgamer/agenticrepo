-- made by bob
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "relatedWorkflow" TEXT,
    "relatedPr" INTEGER,
    "relatedIssue" INTEGER,
    "relatedUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");
CREATE INDEX "ActivityEvent_repository_idx" ON "ActivityEvent"("repository");

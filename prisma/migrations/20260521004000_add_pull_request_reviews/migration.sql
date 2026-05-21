-- made by bob
CREATE TABLE "PullRequestReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewKey" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "repository" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "branch" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "riskClassification" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "changedFiles" TEXT,
    "changedModules" TEXT,
    "architectureImpact" TEXT NOT NULL,
    "workflowImpact" TEXT NOT NULL,
    "affectedDependencies" TEXT,
    "suspiciousPatterns" TEXT,
    "reasoning" TEXT NOT NULL,
    "recommendations" TEXT,
    "deploymentConcerns" TEXT,
    "inlineInsights" TEXT,
    "relatedUrl" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PullRequestReviewStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "PullRequestReviewStep_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PullRequestReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PullRequestReview_reviewKey_key" ON "PullRequestReview"("reviewKey");
CREATE INDEX "PullRequestReview_repository_idx" ON "PullRequestReview"("repository");
CREATE INDEX "PullRequestReview_prNumber_idx" ON "PullRequestReview"("prNumber");
CREATE INDEX "PullRequestReview_startedAt_idx" ON "PullRequestReview"("startedAt");
CREATE INDEX "PullRequestReviewStep_reviewId_idx" ON "PullRequestReviewStep"("reviewId");
CREATE INDEX "PullRequestReviewStep_startedAt_idx" ON "PullRequestReviewStep"("startedAt");

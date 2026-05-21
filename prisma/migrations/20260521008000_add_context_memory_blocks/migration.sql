-- CreateTable
CREATE TABLE "ContextMemoryBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockKey" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "compressedText" TEXT NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "tokenEstimate" INTEGER NOT NULL,
    "providerProfile" TEXT NOT NULL DEFAULT 'standard',
    "metadata" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ContextMemoryBlock_blockKey_key" ON "ContextMemoryBlock"("blockKey");

-- CreateIndex
CREATE INDEX "ContextMemoryBlock_repository_idx" ON "ContextMemoryBlock"("repository");

-- CreateIndex
CREATE INDEX "ContextMemoryBlock_layer_idx" ON "ContextMemoryBlock"("layer");

-- CreateIndex
CREATE INDEX "ContextMemoryBlock_priorityScore_idx" ON "ContextMemoryBlock"("priorityScore");

-- CreateIndex
CREATE INDEX "ContextMemoryBlock_lastUsedAt_idx" ON "ContextMemoryBlock"("lastUsedAt");

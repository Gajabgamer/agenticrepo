-- made by bob
CREATE TABLE "EngineeringMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memoryKey" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "evidence" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "KnowledgeGraphNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeKey" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT,
    "severity" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "KnowledgeGraphEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "edgeKey" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "evidence" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "EngineeringMemory_memoryKey_key" ON "EngineeringMemory"("memoryKey");
CREATE INDEX "EngineeringMemory_repository_idx" ON "EngineeringMemory"("repository");
CREATE INDEX "EngineeringMemory_memoryType_idx" ON "EngineeringMemory"("memoryType");
CREATE INDEX "EngineeringMemory_severity_idx" ON "EngineeringMemory"("severity");
CREATE INDEX "EngineeringMemory_lastSeenAt_idx" ON "EngineeringMemory"("lastSeenAt");
CREATE UNIQUE INDEX "KnowledgeGraphNode_nodeKey_key" ON "KnowledgeGraphNode"("nodeKey");
CREATE INDEX "KnowledgeGraphNode_repository_idx" ON "KnowledgeGraphNode"("repository");
CREATE INDEX "KnowledgeGraphNode_nodeType_idx" ON "KnowledgeGraphNode"("nodeType");
CREATE INDEX "KnowledgeGraphNode_lastSeenAt_idx" ON "KnowledgeGraphNode"("lastSeenAt");
CREATE UNIQUE INDEX "KnowledgeGraphEdge_edgeKey_key" ON "KnowledgeGraphEdge"("edgeKey");
CREATE INDEX "KnowledgeGraphEdge_repository_idx" ON "KnowledgeGraphEdge"("repository");
CREATE INDEX "KnowledgeGraphEdge_sourceKey_idx" ON "KnowledgeGraphEdge"("sourceKey");
CREATE INDEX "KnowledgeGraphEdge_targetKey_idx" ON "KnowledgeGraphEdge"("targetKey");
CREATE INDEX "KnowledgeGraphEdge_relationType_idx" ON "KnowledgeGraphEdge"("relationType");

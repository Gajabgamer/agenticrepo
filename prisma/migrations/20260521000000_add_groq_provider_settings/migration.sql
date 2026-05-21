-- made by bob
ALTER TABLE "User" ADD COLUMN "groqApiKey" TEXT;
ALTER TABLE "User" ADD COLUMN "preferredAiProvider" TEXT NOT NULL DEFAULT 'bob';

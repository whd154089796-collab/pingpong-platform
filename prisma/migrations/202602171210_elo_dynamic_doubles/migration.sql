-- Alter MatchResult to support multi-player (e.g. doubles) Elo settlement
ALTER TABLE "MatchResult"
  ADD COLUMN "winnerTeamIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "loserTeamIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "MatchResult"
  ALTER COLUMN "winnerId" DROP NOT NULL,
  ALTER COLUMN "loserId" DROP NOT NULL;

DROP INDEX IF EXISTS "MatchResult_matchId_winnerId_loserId_key";

CREATE INDEX "MatchResult_matchId_createdAt_idx" ON "MatchResult"("matchId", "createdAt");

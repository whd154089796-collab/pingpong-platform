-- CreateEnum
CREATE TYPE "CompetitionFormat" AS ENUM ('group_only', 'group_then_knockout');

-- AlterTable
ALTER TABLE "Match"
ADD COLUMN "format" "CompetitionFormat" NOT NULL DEFAULT 'group_only',
ADD COLUMN "registrationDeadline" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN "groupingGeneratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MatchGrouping" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MatchGrouping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchGrouping_matchId_key" ON "MatchGrouping"("matchId");

-- AddForeignKey
ALTER TABLE "MatchGrouping" ADD CONSTRAINT "MatchGrouping_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

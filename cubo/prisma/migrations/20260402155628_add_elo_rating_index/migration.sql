/*
  Warnings:

  - You are about to drop the column `rank_placement` on the `USERS` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "USERS" DROP COLUMN "rank_placement";

-- CreateIndex
CREATE INDEX "USERS_elo_rating_idx" ON "USERS"("elo_rating");

/*
  Warnings:

  - You are about to drop the column `equipped_skin_id` on the `USERS` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "USERS" DROP COLUMN "equipped_skin_id",
ADD COLUMN     "equipped_avatar_id" TEXT,
ADD COLUMN     "equipped_card_id" TEXT,
ADD COLUMN     "equipped_tapete_id" TEXT;

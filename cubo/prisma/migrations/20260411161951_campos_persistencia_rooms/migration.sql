/*
  Warnings:

  - Added the required column `room_name` to the `GAME_STATE` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_rules` to the `GAME_STATE` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GAME_STATE" ADD COLUMN     "room_name" TEXT NOT NULL,
ADD COLUMN     "room_rules" JSONB NOT NULL;

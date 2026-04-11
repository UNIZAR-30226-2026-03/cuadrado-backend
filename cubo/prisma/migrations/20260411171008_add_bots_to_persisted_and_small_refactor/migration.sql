/*
  Warnings:

  - The primary key for the `GAME_STATE` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `name` on the `GAME_STATE` table. All the data in the column will be lost.
  - The primary key for the `PAUSED_GAME_PLAYERS` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `room_id` on the `PAUSED_GAME_PLAYERS` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[creator_id,room_name]` on the table `GAME_STATE` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `GAME_STATE` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `game_state_id` to the `PAUSED_GAME_PLAYERS` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PAUSED_GAME_PLAYERS" DROP CONSTRAINT "PAUSED_GAME_PLAYERS_room_id_fkey";

-- DropForeignKey
ALTER TABLE "PAUSED_GAME_PLAYERS" DROP CONSTRAINT "PAUSED_GAME_PLAYERS_user_id_fkey";

-- AlterTable
ALTER TABLE "GAME_STATE" DROP CONSTRAINT "GAME_STATE_pkey",
DROP COLUMN "name",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "GAME_STATE_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PAUSED_GAME_PLAYERS" DROP CONSTRAINT "PAUSED_GAME_PLAYERS_pkey",
DROP COLUMN "room_id",
ADD COLUMN     "controlador" TEXT NOT NULL DEFAULT 'humano',
ADD COLUMN     "dificultad_bot" TEXT,
ADD COLUMN     "game_state_id" TEXT NOT NULL,
ADD COLUMN     "nombre_en_partida" TEXT,
ADD CONSTRAINT "PAUSED_GAME_PLAYERS_pkey" PRIMARY KEY ("game_state_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "GAME_STATE_creator_id_room_name_key" ON "GAME_STATE"("creator_id", "room_name");

-- AddForeignKey
ALTER TABLE "PAUSED_GAME_PLAYERS" ADD CONSTRAINT "PAUSED_GAME_PLAYERS_game_state_id_fkey" FOREIGN KEY ("game_state_id") REFERENCES "GAME_STATE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

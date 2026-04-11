/*
  Warnings:

  - The primary key for the `SKINS` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The required column `id` was added to the `SKINS` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "USER_SKINS" DROP CONSTRAINT "USER_SKINS_skin_id_fkey";

-- AlterTable
ALTER TABLE "SKINS" DROP CONSTRAINT "SKINS_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "SKINS_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "USER_SKINS" ADD CONSTRAINT "USER_SKINS_skin_id_fkey" FOREIGN KEY ("skin_id") REFERENCES "SKINS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

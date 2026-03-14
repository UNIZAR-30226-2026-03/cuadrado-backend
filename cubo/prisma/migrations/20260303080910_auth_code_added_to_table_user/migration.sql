/*
  Warnings:

  - Added the required column `auth_code` to the `USERS` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "USERS" ADD COLUMN     "auth_code" TEXT NOT NULL;

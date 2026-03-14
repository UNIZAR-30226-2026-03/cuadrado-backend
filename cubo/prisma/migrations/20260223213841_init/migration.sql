/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `USERS` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "USERS_email_key" ON "USERS"("email");

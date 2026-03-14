-- AlterTable
ALTER TABLE "USERS" ADD COLUMN     "creation_time" TIMESTAMP(3),
ADD COLUMN     "expiration_time" TIMESTAMP(3),
ALTER COLUMN "auth_code" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "USERS_expiration_time_idx" ON "USERS"("expiration_time");

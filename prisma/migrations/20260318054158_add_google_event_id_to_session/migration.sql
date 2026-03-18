-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "google_event_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "google_access_token" TEXT,
ADD COLUMN     "google_refresh_token" TEXT,
ADD COLUMN     "google_token_expiry" TIMESTAMP(3);

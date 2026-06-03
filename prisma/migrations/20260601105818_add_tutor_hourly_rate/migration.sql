-- DropIndex
DROP INDEX "discussion_likes_thread_id_user_id_key";

-- DropIndex
DROP INDEX "reply_likes_reply_id_user_id_key";

-- AlterTable
ALTER TABLE "discussion_likes" DROP CONSTRAINT "discussion_likes_pkey",
DROP COLUMN "like_id",
ADD CONSTRAINT "discussion_likes_pkey" PRIMARY KEY ("user_id", "thread_id");

-- AlterTable
ALTER TABLE "reply_likes" DROP CONSTRAINT "reply_likes_pkey",
DROP COLUMN "like_id",
ADD CONSTRAINT "reply_likes_pkey" PRIMARY KEY ("user_id", "reply_id");

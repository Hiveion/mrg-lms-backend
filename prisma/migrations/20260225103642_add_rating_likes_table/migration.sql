-- CreateTable
CREATE TABLE "rating_likes" (
    "rating_like_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "review_id" INTEGER NOT NULL,

    CONSTRAINT "rating_likes_pkey" PRIMARY KEY ("rating_like_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rating_likes_user_id_review_id_key" ON "rating_likes"("user_id", "review_id");

-- AddForeignKey
ALTER TABLE "rating_likes" ADD CONSTRAINT "rating_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_likes" ADD CONSTRAINT "rating_likes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "ratings"("rating_id") ON DELETE CASCADE ON UPDATE CASCADE;

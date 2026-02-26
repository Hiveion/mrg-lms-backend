-- CreateTable
CREATE TABLE "ratings" (
    "rating_id" SERIAL NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "overall_rating" DOUBLE PRECISION NOT NULL,
    "teaching_quality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "punctuality" INTEGER NOT NULL,
    "review" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("rating_id")
);

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutors"("tutor_id") ON DELETE CASCADE ON UPDATE CASCADE;

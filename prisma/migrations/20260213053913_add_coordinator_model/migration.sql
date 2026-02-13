-- CreateTable
CREATE TABLE "coordinators" (
    "coordinator_id" SERIAL NOT NULL,
    "department" TEXT,
    "responsibilities" TEXT[],
    "years_of_experience" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "coordinators_pkey" PRIMARY KEY ("coordinator_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coordinators_user_id_key" ON "coordinators"("user_id");

-- AddForeignKey
ALTER TABLE "coordinators" ADD CONSTRAINT "coordinators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

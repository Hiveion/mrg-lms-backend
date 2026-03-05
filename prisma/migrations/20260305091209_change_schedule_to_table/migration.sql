
-- AlterTable
ALTER TABLE "classes" DROP COLUMN "schedule";

-- CreateTable
CREATE TABLE "class_schedules" (
    "schedule_id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "day" "WeekDay" NOT NULL,
    "start_time" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("schedule_id")
);

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

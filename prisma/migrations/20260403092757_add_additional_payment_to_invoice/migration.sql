-- CreateEnum
CREATE TYPE "DiscussionType" AS ENUM ('DISCUSSION', 'QUESTION');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PAYHERE', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "google_access_token" TEXT,
ADD COLUMN     "google_refresh_token" TEXT;

-- CreateTable
CREATE TABLE "discussion_threads" (
    "thread_id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "type" "DiscussionType" NOT NULL DEFAULT 'DISCUSSION',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discussion_threads_pkey" PRIMARY KEY ("thread_id")
);

-- CreateTable
CREATE TABLE "discussion_replies" (
    "reply_id" SERIAL NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_answer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discussion_replies_pkey" PRIMARY KEY ("reply_id")
);

-- CreateTable
CREATE TABLE "discussion_likes" (
    "user_id" INTEGER NOT NULL,
    "thread_id" INTEGER NOT NULL,

    CONSTRAINT "discussion_likes_pkey" PRIMARY KEY ("user_id","thread_id")
);

-- CreateTable
CREATE TABLE "reply_likes" (
    "user_id" INTEGER NOT NULL,
    "reply_id" INTEGER NOT NULL,

    CONSTRAINT "reply_likes_pkey" PRIMARY KEY ("user_id","reply_id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "invoice_id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "additional_payment" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("invoice_id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "item_id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" SERIAL NOT NULL,
    "invoice_id" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'PAYHERE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "proof_url" TEXT,
    "notes" TEXT,
    "paid_by_id" INTEGER NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- AddForeignKey
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "discussion_threads"("thread_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_likes" ADD CONSTRAINT "discussion_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_likes" ADD CONSTRAINT "discussion_likes_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "discussion_threads"("thread_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_likes" ADD CONSTRAINT "reply_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_likes" ADD CONSTRAINT "reply_likes_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "discussion_replies"("reply_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("invoice_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

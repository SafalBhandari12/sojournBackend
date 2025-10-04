-- AlterTable
ALTER TABLE "public"."payments" ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
ADD COLUMN     "razorpaySignature" TEXT,
ADD COLUMN     "refundAmount" DOUBLE PRECISION,
ADD COLUMN     "refundId" TEXT;

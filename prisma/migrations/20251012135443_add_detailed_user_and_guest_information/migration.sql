-- AlterTable
ALTER TABLE "public"."hotel_bookings" ADD COLUMN     "checkInNotes" TEXT,
ADD COLUMN     "specialRequests" TEXT;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "idProofNumber" TEXT,
ADD COLUMN     "idProofType" TEXT,
ADD COLUMN     "lastName" TEXT;

-- CreateTable
CREATE TABLE "public"."guests" (
    "id" TEXT NOT NULL,
    "hotelBookingId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "age" INTEGER,
    "idProofType" TEXT,
    "idProofNumber" TEXT,
    "isPrimaryGuest" BOOLEAN NOT NULL DEFAULT false,
    "specialRequests" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."guests" ADD CONSTRAINT "guests_hotelBookingId_fkey" FOREIGN KEY ("hotelBookingId") REFERENCES "public"."hotel_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

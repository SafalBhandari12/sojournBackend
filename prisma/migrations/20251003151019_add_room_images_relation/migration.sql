/*
  Warnings:

  - Made the column `cancellationPolicy` on table `hotel_profiles` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."hotel_profiles" ALTER COLUMN "cancellationPolicy" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."vendor_images" ADD COLUMN     "roomId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."vendor_images" ADD CONSTRAINT "vendor_images_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

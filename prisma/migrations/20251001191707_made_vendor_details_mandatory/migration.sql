/*
  Warnings:

  - Made the column `email` on table `vendors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `googleMapsLink` on table `vendors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gstNumber` on table `vendors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `panNumber` on table `vendors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `aadhaarNumber` on table `vendors` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."vendors" ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "googleMapsLink" SET NOT NULL,
ALTER COLUMN "gstNumber" SET NOT NULL,
ALTER COLUMN "panNumber" SET NOT NULL,
ALTER COLUMN "aadhaarNumber" SET NOT NULL;

/*
  Warnings:

  - Made the column `amount` on table `payments` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "amount" SET NOT NULL,
ALTER COLUMN "refundAmount" DROP NOT NULL;

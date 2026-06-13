/*
  Warnings:

  - You are about to drop the `Block` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `layout` to the `Page` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_pageId_fkey";

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "layout" JSONB NOT NULL;

-- DropTable
DROP TABLE "Block";

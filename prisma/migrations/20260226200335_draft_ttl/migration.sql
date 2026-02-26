-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "draftExpiresAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Post_draftExpiresAt_idx" ON "Post"("draftExpiresAt");

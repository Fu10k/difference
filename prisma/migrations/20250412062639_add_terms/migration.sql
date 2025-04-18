-- CreateTable
CREATE TABLE "Term" (
    "id" SERIAL NOT NULL,
    "member" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Term_member_key" ON "Term"("member");

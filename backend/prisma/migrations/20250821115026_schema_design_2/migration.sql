/*
  Warnings:

  - A unique constraint covering the columns `[realmId]` on the table `QBOConnection` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "QBOConnection_realmId_key" ON "public"."QBOConnection"("realmId");

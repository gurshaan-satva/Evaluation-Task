/*
  Warnings:

  - You are about to drop the `chart_of_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `qbo_connections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sync_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."chart_of_accounts" DROP CONSTRAINT "chart_of_accounts_qboConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."customers" DROP CONSTRAINT "customers_qboConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."invoices" DROP CONSTRAINT "invoices_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."invoices" DROP CONSTRAINT "invoices_qboConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."items" DROP CONSTRAINT "items_qboConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_qboConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."sync_logs" DROP CONSTRAINT "sync_logs_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."sync_logs" DROP CONSTRAINT "sync_logs_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."sync_logs" DROP CONSTRAINT "sync_logs_qboConnectionId_fkey";

-- DropTable
DROP TABLE "public"."chart_of_accounts";

-- DropTable
DROP TABLE "public"."customers";

-- DropTable
DROP TABLE "public"."invoices";

-- DropTable
DROP TABLE "public"."items";

-- DropTable
DROP TABLE "public"."payments";

-- DropTable
DROP TABLE "public"."qbo_connections";

-- DropTable
DROP TABLE "public"."sync_logs";

-- CreateTable
CREATE TABLE "public"."QBOConnection" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "QBOConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChartOfAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountSubType" TEXT,
    "classification" TEXT,
    "currency" TEXT,
    "currencyName" TEXT,
    "currentBalance" DOUBLE PRECISION,
    "currentBalanceWithSub" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL,
    "subAccount" BOOLEAN NOT NULL,
    "syncToken" TEXT,
    "fullyQualifiedName" TEXT,
    "domain" TEXT,
    "createdAtQB" TIMESTAMP(3),
    "updatedAtQB" TIMESTAMP(3),
    "qboConnectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "billingLine1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "syncToken" TEXT,
    "balance" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "qboConnectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullyQualifiedName" TEXT,
    "type" "public"."ItemType" NOT NULL,
    "description" TEXT,
    "unitPrice" DOUBLE PRECISION,
    "purchaseCost" DOUBLE PRECISION,
    "quantityOnHand" INTEGER,
    "invStartDate" TIMESTAMP(3),
    "incomeAccountRef" TEXT,
    "incomeAccountName" TEXT,
    "expenseAccountRef" TEXT,
    "expenseAccountName" TEXT,
    "assetAccountRef" TEXT,
    "assetAccountName" TEXT,
    "trackQtyOnHand" BOOLEAN,
    "taxable" BOOLEAN,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "syncToken" TEXT,
    "domain" TEXT,
    "createTime" TIMESTAMP(3),
    "lastUpdatedTime" TIMESTAMP(3),
    "qboConnectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "qboInvoiceId" TEXT,
    "customerId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "store" TEXT,
    "billingAddress" TEXT,
    "docNumber" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "syncToken" TEXT,
    "sparse" BOOLEAN,
    "sendLater" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "lineItems" JSONB NOT NULL,
    "qboConnectionId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "public"."SyncStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "qboPaymentId" TEXT,
    "invoiceId" TEXT NOT NULL,
    "qboInvoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "public"."PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "referenceNumber" TEXT,
    "notes" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "depositToAccountRef" TEXT,
    "unappliedAmount" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION,
    "processPayment" BOOLEAN NOT NULL DEFAULT false,
    "linkedTransactions" JSONB,
    "qboConnectionId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "public"."SyncStatus" NOT NULL DEFAULT 'PENDING',
    "syncToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncLog" (
    "id" TEXT NOT NULL,
    "syncId" TEXT NOT NULL,
    "transactionType" "public"."TransactionType" NOT NULL,
    "systemTransactionId" TEXT NOT NULL,
    "quickbooksId" TEXT,
    "status" "public"."SyncStatus" NOT NULL,
    "operation" "public"."SyncOperation" NOT NULL,
    "qboConnectionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_qboInvoiceId_key" ON "public"."Invoice"("qboInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_docNumber_key" ON "public"."Invoice"("docNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_qboPaymentId_key" ON "public"."Payment"("qboPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncLog_syncId_key" ON "public"."SyncLog"("syncId");

-- AddForeignKey
ALTER TABLE "public"."ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."QBOConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."QBOConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Item" ADD CONSTRAINT "Item_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."QBOConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."QBOConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."QBOConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncLog" ADD CONSTRAINT "SyncLog_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."QBOConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncLog" ADD CONSTRAINT "SyncLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncLog" ADD CONSTRAINT "SyncLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

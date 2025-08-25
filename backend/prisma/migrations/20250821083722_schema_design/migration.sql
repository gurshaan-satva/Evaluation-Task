-- CreateEnum
CREATE TYPE "public"."ItemType" AS ENUM ('Service', 'Inventory', 'Category');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CHECK', 'CREDIT_CARD', 'BANK_TRANSFER', 'ACH', 'WIRE_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'RETRY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('INVOICE', 'PAYMENT', 'CUSTOMER', 'ITEM', 'ACCOUNT', 'CHART_OF_ACCOUNT');

-- CreateEnum
CREATE TYPE "public"."SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'READ');

-- CreateTable
CREATE TABLE "public"."qbo_connections" (
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

    CONSTRAINT "qbo_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chart_of_accounts" (
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

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
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

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."items" (
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

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
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

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
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

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sync_logs" (
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

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_qboInvoiceId_key" ON "public"."invoices"("qboInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_docNumber_key" ON "public"."invoices"("docNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_qboPaymentId_key" ON "public"."payments"("qboPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "sync_logs_syncId_key" ON "public"."sync_logs"("syncId");

-- AddForeignKey
ALTER TABLE "public"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."qbo_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."qbo_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."items" ADD CONSTRAINT "items_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."qbo_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."qbo_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."qbo_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sync_logs" ADD CONSTRAINT "sync_logs_qboConnectionId_fkey" FOREIGN KEY ("qboConnectionId") REFERENCES "public"."qbo_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sync_logs" ADD CONSTRAINT "sync_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sync_logs" ADD CONSTRAINT "sync_logs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

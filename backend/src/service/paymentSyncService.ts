// services/paymentSyncService.ts

import axios from 'axios';
import { prisma } from '../config/db';
import { Payment, SyncStatus, SyncOperation, TransactionType } from '@prisma/client';
import pLimit from 'p-limit';

// Helper function to get API base URL
const getQboApiBaseUrl = (): string => {
    return process.env.ENVIRONMENT === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
};

// QuickBooks Payment Payload interface
interface QBOPaymentPayload {
    TotalAmt: number;
    CustomerRef: {
        value: string;
    };
    PaymentMethodRef?: {
        value: string;
    };
    DepositToAccountRef?: {
        value: string;
    };
    PaymentRefNum?: string;
    TxnDate?: string;
    PrivateNote?: string;
    LinkedTxn?: Array<{
        TxnId: string;
        TxnType: string;
    }>;
}

// QuickBooks Payment Response interface
interface QBOPaymentResponse {
    QueryResponse?: any;
    Payment?: {
        Id: string;
        SyncToken: string;
        MetaData: {
            CreateTime: string;
            LastUpdatedTime: string;
        };
        TotalAmt: number;
        UnappliedAmt: number;
        [key: string]: any;
    };
    Fault?: {
        Error: Array<{
            Detail: string;
            code: string;
            element?: string;
        }>;
        type: string;
    };
}

// Response interfaces for service methods
interface PaymentSyncResult {
    success: boolean;
    qboPaymentId?: string;
    syncToken?: string;
    message: string;
    error?: string;
}

interface BatchSyncResult {
    success: boolean;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    results: Array<{
        paymentId: string;
        referenceNumber: string;
        success: boolean;
        qboPaymentId?: string;
        message: string;
        error?: string;
    }>;
    message: string;
}

interface PaymentSyncStatusResult {
    payment: any;
    syncLogs: any[];
    lastSync?: Date;
    status: SyncStatus;
}

interface PaymentsSyncStatusResult {
    payments: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
    summary: {
        totalPayments: number;
        syncedPayments: number;
        pendingPayments: number;
        failedPayments: number;
    };
}

/**
 * Find or create QBO connection based on realmId
 */
const findOrCreateConnection = async (realmId: string, accessToken: string): Promise<string> => {
    try {
        let connection = await prisma.qBOConnection.findUnique({
            where: { realmId }
        });

        if (!connection) {
            console.log(`Creating new QBO connection for realmId: ${realmId}`);
            connection = await prisma.qBOConnection.create({
                data: {
                    realmId,
                    accessToken,
                    refreshToken: '',
                    expiresAt: new Date(Date.now() + 3600 * 1000),
                    refreshExpiresAt: new Date(Date.now() + 101 * 24 * 3600 * 1000),
                    isConnected: true,
                    companyName: `Company-${realmId}`,
                    connectedAt: new Date()
                }
            });
        }

        return connection.id;
    } catch (error) {
        console.error('Error finding/creating QBO connection:', error);
        throw new Error(`Failed to find or create QBO connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Create sync log entry
 */
const createSyncLog = async (data: {
    transactionType: TransactionType;
    systemTransactionId: string;
    quickbooksId?: string;
    status: SyncStatus;
    operation: SyncOperation;
    qboConnectionId: string;
    paymentId?: string;
    requestPayload?: any;
    responsePayload?: any;
    errorMessage?: string;
    errorCode?: string;
}): Promise<void> => {
    try {
        // Try to find existing sync log for this transaction
        const existingSyncLog = await prisma.syncLog.findFirst({
            where: {
                transactionType: data.transactionType,
                systemTransactionId: data.systemTransactionId,
                operation: data.operation,
                qboConnectionId: data.qboConnectionId
            }
        });

        if (existingSyncLog) {
            // Update existing sync log
            await prisma.syncLog.update({
                where: { id: existingSyncLog.id },
                data: {
                    quickbooksId: data.quickbooksId || existingSyncLog.quickbooksId,
                    status: data.status,
                    requestPayload: data.requestPayload || existingSyncLog.requestPayload,
                    responsePayload: data.responsePayload,
                    errorMessage: data.errorMessage,
                    errorCode: data.errorCode,
                    completedAt: data.status !== 'IN_PROGRESS' ? new Date() : undefined
                }
            });
        } else {
            // Create new sync log
            await prisma.syncLog.create({
                data: {
                    transactionType: data.transactionType,
                    systemTransactionId: data.systemTransactionId,
                    quickbooksId: data.quickbooksId,
                    status: data.status,
                    operation: data.operation,
                    qboConnectionId: data.qboConnectionId,
                    paymentId: data.paymentId,
                    requestPayload: data.requestPayload,
                    responsePayload: data.responsePayload,
                    errorMessage: data.errorMessage,
                    errorCode: data.errorCode,
                    startedAt: new Date(),
                    completedAt: data.status !== 'IN_PROGRESS' ? new Date() : undefined
                }
            });
        }
    } catch (error) {
        console.error('Error creating/updating sync log:', error);
    }
};

/**
 * Transform our payment to QuickBooks format
 */
const transformPaymentToQBO = async (payment: Payment & { invoice?: any }): Promise<QBOPaymentPayload> => {
    let customerRef = '1'; // Default customer ID
    let qboInvoiceId: string | null = null;

    // Try to get customer ID and QBO invoice ID from linked invoice
    if (payment.invoiceId) {
        try {
            const invoice = await prisma.invoice.findUnique({
                where: { id: payment.invoiceId },
                select: { customerId: true, qboInvoiceId: true }
            });
            if (invoice?.customerId) {
                customerRef = invoice.customerId;
            }
            if (invoice?.qboInvoiceId) {
                qboInvoiceId = invoice.qboInvoiceId;
            }
        } catch (error) {
            console.warn('Could not fetch customer ID and QBO invoice ID from linked invoice, using defaults');
        }
    }

    // Create a minimal payload that matches QBO's expected format
    const qboPayload: QBOPaymentPayload = {
        TotalAmt: payment.totalAmount || payment.amount,
        CustomerRef: {
            value: customerRef
        }
    };

    // Add optional fields if available
    if (payment.depositToAccountRef) {
        qboPayload.DepositToAccountRef = {
            value: payment.depositToAccountRef
        };
    }

    if (payment.referenceNumber) {
        qboPayload.PaymentRefNum = payment.referenceNumber;
    }

    if (payment.paymentDate) {
        qboPayload.TxnDate = payment.paymentDate.toISOString().split('T')[0];
    }

    if (payment.notes) {
        qboPayload.PrivateNote = payment.notes;
    }

    // Handle linked transactions - prioritize QBO invoice ID over stored linkedTransactions
    if (qboInvoiceId) {
        // Use the QBO invoice ID from the related invoice
        qboPayload.LinkedTxn = [{
            TxnId: qboInvoiceId,
            TxnType: 'Invoice'
        }];
    } else if (payment.linkedTransactions && Array.isArray(payment.linkedTransactions)) {
        // Fallback to existing linkedTransactions if no QBO invoice ID found
        qboPayload.LinkedTxn = payment.linkedTransactions
            .filter((txn): txn is { TxnId: string; TxnType: string } => txn != null)
            .map(txn => ({
                TxnId: txn.TxnId,
                TxnType: txn.TxnType
            }));
    } else if (payment.qboInvoiceId) {
        // If no explicit linked transactions but we have a QBO invoice ID in payment, link to it
        qboPayload.LinkedTxn = [{
            TxnId: payment.qboInvoiceId,
            TxnType: 'Invoice'
        }];
    }

    return qboPayload;
};

/**
 * Sync single payment to QuickBooks
 */
const syncPaymentToQBO = async (
    paymentId: string,
    accessToken: string,
    realmId: string
): Promise<PaymentSyncResult> => {
    try {
        // Get QBO connection
        const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

        // Fetch payment details
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId }
        });

        if (!payment) {
            throw new Error(`Payment with ID ${paymentId} not found`);
        }

        if (payment.qboPaymentId) {
            return {
                success: false,
                message: `Payment ${payment.referenceNumber || paymentId} is already synced to QuickBooks (ID: ${payment.qboPaymentId})`,
                error: 'ALREADY_SYNCED'
            };
        }

        // Transform payment to QuickBooks format
        const qboPayload = await transformPaymentToQBO(payment);

        console.log(`Syncing payment ${payment.referenceNumber || paymentId} to QuickBooks...`);

        // Update sync status to IN_PROGRESS
        await prisma.payment.update({
            where: { id: paymentId },
            data: { syncStatus: 'IN_PROGRESS' }
        });

        // Create initial sync log
        await createSyncLog({
            transactionType: 'PAYMENT',
            systemTransactionId: paymentId,
            status: 'IN_PROGRESS',
            operation: 'CREATE',
            qboConnectionId,
            paymentId,
            requestPayload: qboPayload
        });

        // Make API call to QuickBooks
        const baseUrl = getQboApiBaseUrl();
        const response = await axios.post<QBOPaymentResponse>(
            `${baseUrl}/v3/company/${realmId}/payment`,
            qboPayload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        // Check for QuickBooks errors
        if (response.data.Fault) {
            const error = response.data.Fault.Error[0];
            throw new Error(`QuickBooks API Error: ${error.Detail} (Code: ${error.code})`);
        }

        const qboPayment = response.data.Payment;
        if (!qboPayment) {
            throw new Error('No payment data returned from QuickBooks');
        }

        // Get the QBO invoice ID from the related invoice to update payment record
        let qboInvoiceIdForUpdate: string | null = null;
        let updatedLinkedTransactions: any = null;

        if (payment.invoiceId) {
            try {
                const invoice = await prisma.invoice.findUnique({
                    where: { id: payment.invoiceId },
                    select: { qboInvoiceId: true }
                });
                if (invoice?.qboInvoiceId) {
                    qboInvoiceIdForUpdate = invoice.qboInvoiceId;
                    // Update linkedTransactions to use the correct QBO invoice ID
                    updatedLinkedTransactions = [{
                        TxnId: invoice.qboInvoiceId,
                        TxnType: 'Invoice'
                    }];
                }
            } catch (error) {
                console.warn('Could not fetch QBO invoice ID for payment update:', error);
            }
        }

        // Update our payment with QuickBooks ID and correct invoice mapping
        await prisma.payment.update({
            where: { id: paymentId },
            data: {
                qboPaymentId: qboPayment.Id,
                syncToken: qboPayment.SyncToken,
                syncStatus: 'SUCCESS',
                lastSyncedAt: new Date(),
                unappliedAmount: qboPayment.UnappliedAmt,
                ...(qboInvoiceIdForUpdate && { qboInvoiceId: qboInvoiceIdForUpdate }),
                ...(updatedLinkedTransactions && { linkedTransactions: updatedLinkedTransactions })
            }
        });

        // Create success sync log
        await createSyncLog({
            transactionType: 'PAYMENT',
            systemTransactionId: paymentId,
            quickbooksId: qboPayment.Id,
            status: 'SUCCESS',
            operation: 'CREATE',
            qboConnectionId,
            paymentId,
            requestPayload: qboPayload,
            responsePayload: response.data
        });

        console.log(`✅ Payment ${payment.referenceNumber || paymentId} synced successfully. QBO ID: ${qboPayment.Id}`);

        return {
            success: true,
            qboPaymentId: qboPayment.Id,
            syncToken: qboPayment.SyncToken,
            message: `Payment ${payment.referenceNumber || paymentId} synced successfully to QuickBooks`
        };

    } catch (error) {
        console.error(`❌ Error syncing payment ${paymentId}:`, error);

        let errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let errorCode = 'SYNC_ERROR';

        // Handle Axios errors with QuickBooks API response
        if (axios.isAxiosError(error)) {
            errorCode = error.response?.status?.toString() || 'AXIOS_ERROR';

            // Check for QuickBooks Fault in response
            const qbError = error.response?.data;
            if (qbError?.Fault?.Error?.[0]) {
                const faultError = qbError.Fault.Error[0];
                errorMessage = `QuickBooks API Error: ${faultError.Detail} (Code: ${faultError.code})`;
                console.error('QuickBooks Fault Details:', JSON.stringify(qbError.Fault, null, 2));

                // Log the request payload that caused the error
                console.error('Request payload that caused error:', JSON.stringify(error.config?.data, null, 2));
            } else {
                console.error('Full QuickBooks API Error Response:', JSON.stringify(qbError, null, 2));
            }
        }

        // Update payment sync status to FAILED
        try {
            await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    syncStatus: 'FAILED',
                    lastSyncedAt: new Date()
                }
            });

            // Get connection for error log
            const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

            // Create error sync log
            await createSyncLog({
                transactionType: 'PAYMENT',
                systemTransactionId: paymentId,
                status: 'FAILED',
                operation: 'CREATE',
                qboConnectionId,
                paymentId,
                errorMessage,
                errorCode,
                responsePayload: axios.isAxiosError(error) ? error.response?.data : undefined
            });
        } catch (logError) {
            console.error('Error updating payment status or creating error log:', logError);
        }

        return {
            success: false,
            message: `Failed to sync payment: ${errorMessage}`,
            error: errorMessage
        };
    }
};

/**
 * Sync all pending payments to QuickBooks with concurrency limiting
 */
const syncAllPaymentsToQBO = async (
    accessToken: string,
    realmId: string
): Promise<BatchSyncResult> => {
    try {
        // Import p-limit for concurrency control
        const limit = pLimit(3); // Allow maximum 3 concurrent requests to avoid rate limiting

        // Get QBO connection
        const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

        // Fetch ALL pending payments for this connection (we'll process in batches)
        const pendingPayments = await prisma.payment.findMany({
            where: {
                qboConnectionId,
                syncStatus: 'PENDING',
                qboPaymentId: null // Only sync payments that haven't been synced yet
            },
            include: {
                invoice: {
                    select: {
                        id: true,
                        docNumber: true,
                        qboInvoiceId: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc' // Sync oldest first
            }
        });

        if (pendingPayments.length === 0) {
            return {
                success: true,
                totalProcessed: 0,
                successCount: 0,
                failureCount: 0,
                results: [],
                message: 'No pending payments found to sync'
            };
        }

        console.log(`📋 Found ${pendingPayments.length} pending payments to sync in batches of 10`);

        const results = [];
        let successCount = 0;
        let failureCount = 0;
        const BATCH_SIZE = 10;

        // Process payments in batches of 10
        for (let i = 0; i < pendingPayments.length; i += BATCH_SIZE) {
            const batch = pendingPayments.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(pendingPayments.length / BATCH_SIZE);

            console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} payments)`);

            // Process batch with concurrency control
            const batchPromises = batch.map(payment => 
                limit(async () => {
                    console.log(`💰 Processing payment ${payment.referenceNumber || payment.id}...`);
                    
                    const syncResult = await syncPaymentToQBO(payment.id, accessToken, realmId);
                    
                    const result = {
                        paymentId: payment.id,
                        referenceNumber: payment.referenceNumber || `Payment-${payment.id}`,
                        invoiceId: payment.invoiceId,
                        success: syncResult.success,
                        qboPaymentId: syncResult.qboPaymentId,
                        message: syncResult.message,
                        error: syncResult.error,
                        batchNumber
                    };

                    if (syncResult.success) {
                        successCount++;
                        console.log(`✅ Payment ${payment.referenceNumber || payment.id} synced successfully`);
                    } else {
                        failureCount++;
                        console.log(`❌ Payment ${payment.referenceNumber || payment.id} failed: ${syncResult.error}`);
                    }

                    return result;
                })
            );

            // Wait for current batch to complete
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add delay between batches to respect rate limits
            if (i + BATCH_SIZE < pendingPayments.length) {
                console.log(`⏱️  Waiting 2 seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Log batch completion
            const batchSuccessCount = batchResults.filter(r => r.success).length;
            const batchFailureCount = batchResults.filter(r => !r.success).length;
            console.log(`📊 Batch ${batchNumber} completed: ${batchSuccessCount} success, ${batchFailureCount} failed`);
        }

        const message = `Batch sync completed: ${successCount} successful, ${failureCount} failed out of ${pendingPayments.length} payments (processed in ${Math.ceil(pendingPayments.length / BATCH_SIZE)} batches)`;
        console.log(`📊 ${message}`);

        return {
            success: true,
            totalProcessed: pendingPayments.length,
            successCount,
            failureCount,
            results,
            message
        };

    } catch (error) {
        console.error('❌ Error in batch payment sync:', error);
        throw new Error(`Batch payment sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get payment sync status
 */
const getPaymentSyncStatus = async (paymentId: string): Promise<PaymentSyncStatusResult> => {
    try {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId }
        });

        if (!payment) {
            throw new Error(`Payment with ID ${paymentId} not found`);
        }

        const syncLogs = await prisma.syncLog.findMany({
            where: {
                transactionType: 'PAYMENT',
                systemTransactionId: paymentId
            },
            orderBy: {
                timestamp: 'desc'
            },
            take: 10 // Last 10 sync attempts
        });

        return {
            payment,
            syncLogs,
            lastSync: payment.lastSyncedAt ?? undefined,
            status: payment.syncStatus
        };

    } catch (error) {
        throw new Error(`Failed to get payment sync status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get all payments with their sync status (with pagination)
 */
const getAllPaymentsSyncStatus = async (options: {
    page: number;
    limit: number;
    syncStatus?: string;
    status?: string;
    realmId: string;
    dateFrom?: string;
    dateTo?: string;
}): Promise<PaymentsSyncStatusResult> => {
    try {
        const { page, limit, syncStatus, status, realmId, dateFrom, dateTo } = options;
        const skip = (page - 1) * limit;

        // Get QBO connection for this realm
        const connection = await prisma.qBOConnection.findUnique({
            where: { realmId }
        });

        if (!connection) {
            throw new Error('QuickBooks connection not found for this realm');
        }

        // Build where clause
        const where: any = {
            qboConnectionId: connection.id
        };

        if (syncStatus) {
            where.syncStatus = syncStatus;
        }

        if (status) {
            where.status = status;
        }

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom);
            if (dateTo) where.createdAt.lte = new Date(dateTo);
        }

        // Get total count
        const totalCount = await prisma.payment.count({ where });

        // Get payments with pagination
        const payments = await prisma.payment.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        const totalPages = Math.ceil(totalCount / limit);

        // Calculate summary statistics
        const allPayments = await prisma.payment.findMany({
            where: { qboConnectionId: connection.id },
            select: {
                qboPaymentId: true,
                syncStatus: true
            }
        });

        const summary = {
            totalPayments: allPayments.length,
            syncedPayments: allPayments.filter(payment => payment.qboPaymentId).length,
            pendingPayments: allPayments.filter(payment => payment.syncStatus === 'PENDING').length,
            failedPayments: allPayments.filter(payment => payment.syncStatus === 'FAILED').length
        };

        return {
            payments: payments.map(payment => ({
                id: payment.id,
                referenceNumber: payment.referenceNumber,
                amount: payment.amount,
                status: payment.status,
                qboPaymentId: payment.qboPaymentId,
                syncStatus: payment.syncStatus,
                lastSyncedAt: payment.lastSyncedAt,
                createdAt: payment.createdAt,
                isSynced: !!payment.qboPaymentId
            })),
            totalCount,
            totalPages,
            currentPage: page,
            summary
        };

    } catch (error) {
        throw new Error(`Failed to get payments sync status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get sync statistics for a realm
 */
const getSyncStatistics = async (realmId: string): Promise<{
    payments: {
        total: number;
        synced: number;
        pending: number;
        failed: number;
        syncedPercentage: string;
    };
    syncAttempts: {
        total: number;
        successful: number;
        failed: number;
        successRate: string;
    };
    lastSyncAt: Date | null;
}> => {
    try {
        // Get connection for this realm
        const connection = await prisma.qBOConnection.findUnique({
            where: { realmId }
        });

        if (!connection) {
            throw new Error('QuickBooks connection not found');
        }

        // Get payment statistics
        const totalPayments = await prisma.payment.count({
            where: { qboConnectionId: connection.id }
        });

        const syncedPayments = await prisma.payment.count({
            where: {
                qboConnectionId: connection.id,
                qboPaymentId: { not: null }
            }
        });

        const pendingPayments = await prisma.payment.count({
            where: {
                qboConnectionId: connection.id,
                syncStatus: 'PENDING'
            }
        });

        const failedPayments = await prisma.payment.count({
            where: {
                qboConnectionId: connection.id,
                syncStatus: 'FAILED'
            }
        });

        // Get sync logs statistics
        const totalSyncAttempts = await prisma.syncLog.count({
            where: {
                transactionType: 'PAYMENT',
                qboConnectionId: connection.id
            }
        });

        const successfulSyncs = await prisma.syncLog.count({
            where: {
                transactionType: 'PAYMENT',
                qboConnectionId: connection.id,
                status: 'SUCCESS'
            }
        });

        const failedSyncs = await prisma.syncLog.count({
            where: {
                transactionType: 'PAYMENT',
                qboConnectionId: connection.id,
                status: 'FAILED'
            }
        });

        // Calculate success rate
        const successRate = totalSyncAttempts > 0
            ? ((successfulSyncs / totalSyncAttempts) * 100).toFixed(2)
            : '0';

        return {
            payments: {
                total: totalPayments,
                synced: syncedPayments,
                pending: pendingPayments,
                failed: failedPayments,
                syncedPercentage: totalPayments > 0
                    ? ((syncedPayments / totalPayments) * 100).toFixed(2)
                    : '0'
            },
            syncAttempts: {
                total: totalSyncAttempts,
                successful: successfulSyncs,
                failed: failedSyncs,
                successRate: successRate + '%'
            },
            lastSyncAt: connection.lastSyncAt
        };

    } catch (error) {
        throw new Error(`Failed to get sync statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get all payments with pagination and filtering
 */
const getPayments = async (options: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    syncStatus?: string;
    paymentMethod?: string;
    realmId: string;
    dateFrom?: string;
    dateTo?: string;
    invoiceId?: string;
}): Promise<{
    payments: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
    summary: {
        totalPayments: number;
        pendingPayments: number;
        completedPayments: number;
        failedPayments: number;
        syncedPayments: number;
        pendingSyncPayments: number;
        totalAmount: number;
        completedAmount: number;
        pendingAmount: number;
    };
}> => {
    try {
        const { page, limit, search, status, syncStatus, paymentMethod, realmId, dateFrom, dateTo, invoiceId } = options;
        const skip = (page - 1) * limit;

        // Get QBO connection for this realm
        const connection = await prisma.qBOConnection.findUnique({
            where: { realmId }
        });

        if (!connection) {
            throw new Error('QuickBooks connection not found for this realm');
        }

        // Build where clause
        const where: any = {
            qboConnectionId: connection.id
        };

        if (search) {
            where.OR = [
                { referenceNumber: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
                { invoice: { docNumber: { contains: search, mode: 'insensitive' } } }
            ];
        }

        if (status) {
            where.status = status;
        }

        if (syncStatus) {
            where.syncStatus = syncStatus;
        }

        if (paymentMethod) {
            where.paymentMethod = paymentMethod;
        }

        if (invoiceId) {
            where.invoiceId = invoiceId;
        }

        if (dateFrom || dateTo) {
            where.paymentDate = {};
            if (dateFrom) where.paymentDate.gte = new Date(dateFrom);
            if (dateTo) where.paymentDate.lte = new Date(dateTo);
        }

        // Get total count
        const totalCount = await prisma.payment.count({ where });

        // Get payments with pagination
        const payments = await prisma.payment.findMany({
            where,
            include: {
                invoice: {
                    select: {
                        id: true,
                        docNumber: true,
                        total: true,
                        status: true,
                        customer: {
                            select: {
                                id: true,
                                displayName: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        const totalPages = Math.ceil(totalCount / limit);

        // Calculate summary statistics for this connection
        const allPayments = await prisma.payment.findMany({
            where: { qboConnectionId: connection.id },
            select: {
                status: true,
                syncStatus: true,
                qboPaymentId: true,
                amount: true,
                totalAmount: true
            }
        });

        const summary = {
            totalPayments: allPayments.length,
            pendingPayments: allPayments.filter(pay => pay.status === 'PENDING').length,
            completedPayments: allPayments.filter(pay => pay.status === 'COMPLETED').length,
            failedPayments: allPayments.filter(pay => pay.status === 'FAILED').length,
            syncedPayments: allPayments.filter(pay => pay.qboPaymentId).length,
            pendingSyncPayments: allPayments.filter(pay => pay.syncStatus === 'PENDING').length,
            totalAmount: allPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0),
            completedAmount: allPayments.filter(pay => pay.status === 'COMPLETED').reduce((sum, pay) => sum + (pay.amount || 0), 0),
            pendingAmount: allPayments.filter(pay => pay.status === 'PENDING').reduce((sum, pay) => sum + (pay.amount || 0), 0)
        };

        return {
            payments: payments.map(payment => ({
                id: payment.id,
                qboPaymentId: payment.qboPaymentId,
                invoiceId: payment.invoiceId,
                qboInvoiceId: payment.qboInvoiceId,
                invoice: payment.invoice,
                amount: payment.amount,
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                referenceNumber: payment.referenceNumber,
                notes: payment.notes,
                status: payment.status,
                syncStatus: payment.syncStatus,
                syncToken: payment.syncToken,
                lastSyncedAt: payment.lastSyncedAt,
                depositToAccountRef: payment.depositToAccountRef,
                unappliedAmount: payment.unappliedAmount,
                totalAmount: payment.totalAmount,
                processPayment: payment.processPayment,
                linkedTransactions: payment.linkedTransactions,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                isSynced: !!payment.qboPaymentId
            })),
            totalCount,
            totalPages,
            currentPage: page,
            summary
        };

    } catch (error) {
        throw new Error(`Failed to get payments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get payment by ID
 */
/**
 * Get payment by ID
 */
const getPaymentById = async (paymentId: string, realmId: string): Promise<any> => {
    try {
        // Get QBO connection for this realm
        const connection = await prisma.qBOConnection.findUnique({
            where: { realmId }
        });

        if (!connection) {
            throw new Error('QuickBooks connection not found for this realm');
        }

        const payment = await prisma.payment.findFirst({
            where: {
                id: paymentId,
                qboConnectionId: connection.id
            }
        });

        if (!payment) {
            throw new Error(`Payment with ID ${paymentId} not found`);
        }

        return {
            ...payment,
            isSynced: !!payment.qboPaymentId
        };

    } catch (error) {
        throw new Error(`Failed to get payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};


//     try {
//         // Get QBO connection for this realm
//         const connection = await prisma.qBOConnection.findUnique({
//             where: { realmId }
//         });

//         if (!connection) {
//             throw new Error('QuickBooks connection not found for this realm');
//         }

//         const payments = await prisma.payment.findMany({
//             where: {
//                 invoiceId,
//                 qboConnectionId: connection.id
//             },
//             orderBy: {
//                 paymentDate: 'desc'
//             }
//         });

//         return payments.map(payment => ({
//             ...payment,
//             isSynced: !!payment.qboPaymentId
//         }));

//     } catch (error) {
//         throw new Error(`Failed to get payments for invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
// };

/**
 * Update existing payments to map qboInvoiceId and linkedTransactions from related invoices
 * This function fixes payments that have null qboInvoiceId values
 */
const updatePaymentInvoiceMappings = async (accessToken: string, realmId: string): Promise<{
    success: boolean;
    totalProcessed: number;
    updatedCount: number;
    message: string;
}> => {
    try {
        // Get QBO connection
        const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

        // Find payments that have null qboInvoiceId but have a related invoice with qboInvoiceId
        const paymentsToUpdate = await prisma.payment.findMany({
            where: {
                qboConnectionId,
                OR: [
                    { qboInvoiceId: null },
                    { qboInvoiceId: '' }
                ]
            },
            include: {
                invoice: {
                    select: {
                        id: true,
                        qboInvoiceId: true,
                        docNumber: true
                    }
                }
            }
        });

        if (paymentsToUpdate.length === 0) {
            return {
                success: true,
                totalProcessed: 0,
                updatedCount: 0,
                message: 'No payments found that need invoice mapping updates'
            };
        }

        console.log(`📋 Found ${paymentsToUpdate.length} payments to update with invoice mappings`);

        let updatedCount = 0;
        const limit = pLimit(5); // Process 5 at a time to avoid overwhelming the database

        const updatePromises = paymentsToUpdate.map(payment =>
            limit(async () => {
                // Only update if the related invoice has a qboInvoiceId
                if (payment.invoice?.qboInvoiceId) {
                    try {
                        await prisma.payment.update({
                            where: { id: payment.id },
                            data: {
                                qboInvoiceId: payment.invoice.qboInvoiceId,
                                linkedTransactions: [{
                                    TxnId: payment.invoice.qboInvoiceId,
                                    TxnType: 'Invoice'
                                }]
                            }
                        });

                        updatedCount++;
                        console.log(`✅ Updated payment ${payment.referenceNumber || payment.id} with QBO invoice ID: ${payment.invoice.qboInvoiceId}`);
                    } catch (error) {
                        console.error(`❌ Failed to update payment ${payment.referenceNumber || payment.id}:`, error);
                    }
                } else {
                    console.log(`⚠️  Skipping payment ${payment.referenceNumber || payment.id} - related invoice ${payment.invoice?.docNumber} has no QBO ID`);
                }
            })
        );

        await Promise.all(updatePromises);

        const message = `Updated ${updatedCount} out of ${paymentsToUpdate.length} payments with invoice mappings`;
        console.log(`📊 ${message}`);

        return {
            success: true,
            totalProcessed: paymentsToUpdate.length,
            updatedCount,
            message
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error updating payment invoice mappings:', error);

        return {
            success: false,
            totalProcessed: 0,
            updatedCount: 0,
            message: `Failed to update payment invoice mappings: ${errorMessage}`
        };
    }
};

// Export all service functions
const paymentSyncService = {
    syncPaymentToQBO,
    syncAllPaymentsToQBO,
    getPaymentSyncStatus,
    getAllPaymentsSyncStatus,
    getSyncStatistics,
    getPayments,
    getPaymentById,
    updatePaymentInvoiceMappings
};

export default paymentSyncService;

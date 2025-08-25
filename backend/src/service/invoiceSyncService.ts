// services/invoiceSyncService.ts

import axios from 'axios';
import { prisma } from '../config/db';
import { Invoice, SyncStatus, SyncOperation, TransactionType } from '@prisma/client';
import pLimit from 'p-limit';
import { BatchSyncResult, InvoicesSyncStatusResult, InvoiceSyncResult, InvoiceSyncStatusResult, QBOInvoiceLineItem, QBOInvoicePayload, QBOInvoiceResponse } from '../types/invoices';

// Helper function to get API base URL
const getQboApiBaseUrl = (): string => {
    return process.env.ENVIRONMENT === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
};

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
    invoiceId?: string;
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
                    invoiceId: data.invoiceId,
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
 * Transform our invoice line items to QuickBooks format
 */
const transformLineItemsToQBO = (lineItems: any[]): QBOInvoiceLineItem[] => {
    const qboLineItems: QBOInvoiceLineItem[] = [];

    for (const item of lineItems) {
        if (item.detailType === 'SalesItemLineDetail') {
            // Include essential fields that QBO expects
            // For inventory items, Qty is required; for service items, it's optional
            const salesItemLineDetail: any = {
                ItemRef: {
                    value: item.itemRef,
                    name: item.itemName
                }
            };

            // Always include quantity if available (required for inventory items)
            if (item.quantity !== undefined && item.quantity !== null) {
                salesItemLineDetail.Qty = item.quantity;
            }

            qboLineItems.push({
                DetailType: 'SalesItemLineDetail',
                Amount: item.amount,
                SalesItemLineDetail: salesItemLineDetail
            });
        }
        // Skip tax line items for now as they might be causing issues
        // QBO can calculate taxes automatically based on customer settings
    }

    return qboLineItems;
};



/**
 * Transform our invoice to QuickBooks format
 */
const transformInvoiceToQBO = async (invoice: Invoice & { customer: any }): Promise<QBOInvoicePayload> => {
    const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

    // Create a minimal payload that matches QBO's expected format
    const qboPayload: QBOInvoicePayload = {
        Line: transformLineItemsToQBO(lineItems),
        CustomerRef: {
            value: invoice.customerId
        }
    };

    return qboPayload;
};

/**
 * Sync single invoice to QuickBooks
 */
const syncInvoiceToQBO = async (
    invoiceId: string,
    accessToken: string,
    realmId: string
): Promise<InvoiceSyncResult> => {
    try {
        // Get QBO connection
        const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

        // Fetch invoice with customer details
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                customer: true
            }
        });

        if (!invoice) {
            throw new Error(`Invoice with ID ${invoiceId} not found`);
        }

        if (invoice.qboInvoiceId) {
            return {
                success: false,
                message: `Invoice ${invoice.docNumber} is already synced to QuickBooks (ID: ${invoice.qboInvoiceId})`,
                error: 'ALREADY_SYNCED'
            };
        }

        // Transform invoice to QuickBooks format
        const qboPayload = await transformInvoiceToQBO(invoice);

        console.log(`Syncing invoice ${invoice.docNumber} to QuickBooks...`);

        // Update sync status to IN_PROGRESS
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { syncStatus: 'IN_PROGRESS' }
        });

        // Create initial sync log
        await createSyncLog({
            transactionType: 'INVOICE',
            systemTransactionId: invoiceId,
            status: 'IN_PROGRESS',
            operation: 'CREATE',
            qboConnectionId,
            invoiceId,
            requestPayload: qboPayload
        });

        // Make API call to QuickBooks
        const baseUrl = getQboApiBaseUrl();
        const response = await axios.post<QBOInvoiceResponse>(
            `${baseUrl}/v3/company/${realmId}/invoice`,
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

        const qboInvoice = response.data.Invoice;
        if (!qboInvoice) {
            throw new Error('No invoice data returned from QuickBooks');
        }

        // Update our invoice with QuickBooks ID
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                qboInvoiceId: qboInvoice.Id,
                syncToken: qboInvoice.SyncToken,
                syncStatus: 'SUCCESS',
                lastSyncedAt: new Date()
            }
        });

        // Create success sync log
        await createSyncLog({
            transactionType: 'INVOICE',
            systemTransactionId: invoiceId,
            quickbooksId: qboInvoice.Id,
            status: 'SUCCESS',
            operation: 'CREATE',
            qboConnectionId,
            invoiceId,
            requestPayload: qboPayload,
            responsePayload: response.data
        });

        console.log(`✅ Invoice ${invoice.docNumber} synced successfully. QBO ID: ${qboInvoice.Id}`);

        return {
            success: true,
            qboInvoiceId: qboInvoice.Id,
            syncToken: qboInvoice.SyncToken,
            message: `Invoice ${invoice.docNumber} synced successfully to QuickBooks`
        };

    } catch (error) {
        console.error(`❌ Error syncing invoice ${invoiceId}:`, error);

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

        // Update invoice sync status to FAILED
        try {
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    syncStatus: 'FAILED',
                    lastSyncedAt: new Date()
                }
            });

            // Get connection for error log
            const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

            // Create error sync log
            await createSyncLog({
                transactionType: 'INVOICE',
                systemTransactionId: invoiceId,
                status: 'FAILED',
                operation: 'CREATE',
                qboConnectionId,
                invoiceId,
                errorMessage,
                errorCode,
                responsePayload: axios.isAxiosError(error) ? error.response?.data : undefined
            });
        } catch (logError) {
            console.error('Error updating invoice status or creating error log:', logError);
        }

        return {
            success: false,
            message: `Failed to sync invoice: ${errorMessage}`,
            error: errorMessage
        };
    }
};

/**
 * Sync all pending invoices to QuickBooks
 */
const syncAllInvoicesToQBO = async (
    accessToken: string,
    realmId: string
): Promise<BatchSyncResult> => {
    try {
        // Import p-limit for concurrency control

        const limit = pLimit(3); // Allow maximum 3 concurrent requests to avoid rate limiting

        // Get QBO connection
        const qboConnectionId = await findOrCreateConnection(realmId, accessToken);

        // Fetch ALL pending invoices for this connection (we'll process in batches)
        const pendingInvoices = await prisma.invoice.findMany({
            where: {
                qboConnectionId,
                syncStatus: 'PENDING',
                qboInvoiceId: null // Only sync invoices that haven't been synced yet
            },
            include: {
                customer: true
            },
            orderBy: {
                createdAt: 'asc' // Sync oldest first
            }
        });

        if (pendingInvoices.length === 0) {
            return {
                success: true,
                totalProcessed: 0,
                successCount: 0,
                failureCount: 0,
                results: [],
                message: 'No pending invoices found to sync'
            };
        }

        console.log(`📋 Found ${pendingInvoices.length} pending invoices to sync in batches of 10`);

        const results = [];
        let successCount = 0;
        let failureCount = 0;
        const BATCH_SIZE = 10;

        // Process invoices in batches of 10
        for (let i = 0; i < pendingInvoices.length; i += BATCH_SIZE) {
            const batch = pendingInvoices.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(pendingInvoices.length / BATCH_SIZE);

            console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} invoices)`);

            // Process batch with concurrency control
            const batchPromises = batch.map(invoice => 
                limit(async () => {
                    console.log(`📄 Processing invoice ${invoice.docNumber}...`);
                    
                    const syncResult = await syncInvoiceToQBO(invoice.id, accessToken, realmId);
                    
                    const result = {
                        invoiceId: invoice.id,
                        docNumber: invoice.docNumber || `Invoice-${invoice.id}`,
                        success: syncResult.success,
                        qboInvoiceId: syncResult.qboInvoiceId,
                        message: syncResult.message,
                        error: syncResult.error,
                        batchNumber
                    };

                    if (syncResult.success) {
                        successCount++;
                        console.log(`✅ Invoice ${invoice.docNumber} synced successfully`);
                    } else {
                        failureCount++;
                        console.log(`❌ Invoice ${invoice.docNumber} failed: ${syncResult.error}`);
                    }

                    return result;
                })
            );

            // Wait for current batch to complete
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add delay between batches to respect rate limits
            if (i + BATCH_SIZE < pendingInvoices.length) {
                console.log(`⏱️  Waiting 2 seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Log batch completion
            const batchSuccessCount = batchResults.filter(r => r.success).length;
            const batchFailureCount = batchResults.filter(r => !r.success).length;
            console.log(`📊 Batch ${batchNumber} completed: ${batchSuccessCount} success, ${batchFailureCount} failed`);
        }

        const message = `Batch sync completed: ${successCount} successful, ${failureCount} failed out of ${pendingInvoices.length} invoices (processed in ${Math.ceil(pendingInvoices.length / BATCH_SIZE)} batches)`;
        console.log(`📊 ${message}`);

        return {
            success: true,
            totalProcessed: pendingInvoices.length,
            successCount,
            failureCount,
            results,
            message
        };

    } catch (error) {
        console.error('❌ Error in batch invoice sync:', error);
        throw new Error(`Batch invoice sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};


/**
 * Get invoice sync status
 */
const getInvoiceSyncStatus = async (invoiceId: string): Promise<InvoiceSyncStatusResult> => {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                customer: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true
                    }
                }
            }
        });

        if (!invoice) {
            throw new Error(`Invoice with ID ${invoiceId} not found`);
        }

        const syncLogs = await prisma.syncLog.findMany({
            where: {
                transactionType: 'INVOICE',
                systemTransactionId: invoiceId
            },
            orderBy: {
                timestamp: 'desc'
            },
            take: 10 // Last 10 sync attempts
        });

        return {
            invoice,
            syncLogs,
            lastSync: invoice.lastSyncedAt ?? undefined,
            status: invoice.syncStatus
        };

    } catch (error) {
        throw new Error(`Failed to get invoice sync status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get all invoices with their sync status (with pagination)
 */
const getAllInvoicesSyncStatus = async (options: {
    page: number;
    limit: number;
    syncStatus?: string;
    status?: string;
    realmId: string;
    dateFrom?: string;
    dateTo?: string;
}): Promise<InvoicesSyncStatusResult> => {
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
        const totalCount = await prisma.invoice.count({ where });

        // Get invoices with pagination
        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                customer: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        const totalPages = Math.ceil(totalCount / limit);

        // Calculate summary statistics
        const allInvoices = await prisma.invoice.findMany({
            where: { qboConnectionId: connection.id },
            select: {
                qboInvoiceId: true,
                syncStatus: true
            }
        });

        const summary = {
            totalInvoices: allInvoices.length,
            syncedInvoices: allInvoices.filter(inv => inv.qboInvoiceId).length,
            pendingInvoices: allInvoices.filter(inv => inv.syncStatus === 'PENDING').length,
            failedInvoices: allInvoices.filter(inv => inv.syncStatus === 'FAILED').length
        };

        return {
            invoices: invoices.map(invoice => ({
                id: invoice.id,
                docNumber: invoice.docNumber,
                total: invoice.total,
                status: invoice.status,
                qboInvoiceId: invoice.qboInvoiceId,
                syncStatus: invoice.syncStatus,
                lastSyncedAt: invoice.lastSyncedAt,
                customer: invoice.customer,
                createdAt: invoice.createdAt,
                isSynced: !!invoice.qboInvoiceId
            })),
            totalCount,
            totalPages,
            currentPage: page,
            summary
        };

    } catch (error) {
        throw new Error(`Failed to get invoices sync status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get sync statistics for a realm
 */
const getSyncStatistics = async (realmId: string): Promise<{
    invoices: {
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

        // Get invoice statistics
        const totalInvoices = await prisma.invoice.count({
            where: { qboConnectionId: connection.id }
        });

        const syncedInvoices = await prisma.invoice.count({
            where: {
                qboConnectionId: connection.id,
                qboInvoiceId: { not: null }
            }
        });

        const pendingInvoices = await prisma.invoice.count({
            where: {
                qboConnectionId: connection.id,
                syncStatus: 'PENDING'
            }
        });

        const failedInvoices = await prisma.invoice.count({
            where: {
                qboConnectionId: connection.id,
                syncStatus: 'FAILED'
            }
        });

        // Get sync logs statistics
        const totalSyncAttempts = await prisma.syncLog.count({
            where: {
                transactionType: 'INVOICE',
                qboConnectionId: connection.id
            }
        });

        const successfulSyncs = await prisma.syncLog.count({
            where: {
                transactionType: 'INVOICE',
                qboConnectionId: connection.id,
                status: 'SUCCESS'
            }
        });

        const failedSyncs = await prisma.syncLog.count({
            where: {
                transactionType: 'INVOICE',
                qboConnectionId: connection.id,
                status: 'FAILED'
            }
        });

        // Calculate success rate
        const successRate = totalSyncAttempts > 0 
            ? ((successfulSyncs / totalSyncAttempts) * 100).toFixed(2)
            : '0';

        return {
            invoices: {
                total: totalInvoices,
                synced: syncedInvoices,
                pending: pendingInvoices,
                failed: failedInvoices,
                syncedPercentage: totalInvoices > 0 
                    ? ((syncedInvoices / totalInvoices) * 100).toFixed(2)
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
const getInvoices = async (options: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    syncStatus?: string;
    realmId: string;
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
}): Promise<{
    invoices: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
    summary: {
        totalInvoices: number;
        draftInvoices: number;
        sentInvoices: number;
        paidInvoices: number;
        overdueInvoices: number;
        syncedInvoices: number;
        pendingSyncInvoices: number;
        totalAmount: number;
        paidAmount: number;
        outstandingAmount: number;
    };
}> => {
    try {
        const { page, limit, search, status, syncStatus, realmId, dateFrom, dateTo, customerId } = options;
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
                { docNumber: { contains: search, mode: 'insensitive' } },
                { store: { contains: search, mode: 'insensitive' } },
                { customer: { displayName: { contains: search, mode: 'insensitive' } } },
                { customer: { email: { contains: search, mode: 'insensitive' } } }
            ];
        }

        if (status) {
            where.status = status;
        }

        if (syncStatus) {
            where.syncStatus = syncStatus;
        }

        if (customerId) {
            where.customerId = customerId;
        }

        if (dateFrom || dateTo) {
            where.invoiceDate = {};
            if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
            if (dateTo) where.invoiceDate.lte = new Date(dateTo);
        }

        // Get total count
        const totalCount = await prisma.invoice.count({ where });

        // Get invoices with pagination
        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                customer: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        const totalPages = Math.ceil(totalCount / limit);

        // Calculate summary statistics for this connection
        const allInvoices = await prisma.invoice.findMany({
            where: { qboConnectionId: connection.id },
            select: {
                status: true,
                syncStatus: true,
                qboInvoiceId: true,
                total: true,
                subtotal: true
            }
        });

        const summary = {
            totalInvoices: allInvoices.length,
            draftInvoices: allInvoices.filter(inv => inv.status === 'DRAFT').length,
            sentInvoices: allInvoices.filter(inv => inv.status === 'SENT').length,
            paidInvoices: allInvoices.filter(inv => inv.status === 'PAID').length,
            overdueInvoices: allInvoices.filter(inv => inv.status === 'OVERDUE').length,
            syncedInvoices: allInvoices.filter(inv => inv.qboInvoiceId).length,
            pendingSyncInvoices: allInvoices.filter(inv => inv.syncStatus === 'PENDING').length,
            totalAmount: allInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
            paidAmount: allInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + (inv.total || 0), 0),
            outstandingAmount: allInvoices.filter(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED').reduce((sum, inv) => sum + (inv.total || 0), 0)
        };

        return {
            invoices: invoices.map(invoice => ({
                id: invoice.id,
                docNumber: invoice.docNumber,
                customerId: invoice.customerId,
                customer: invoice.customer,
                invoiceDate: invoice.invoiceDate,
                dueDate: invoice.dueDate,
                store: invoice.store,
                billingAddress: invoice.billingAddress,
                subtotal: invoice.subtotal,
                total: invoice.total,
                status: invoice.status,
                syncStatus: invoice.syncStatus,
                qboInvoiceId: invoice.qboInvoiceId,
                syncToken: invoice.syncToken,
                lastSyncedAt: invoice.lastSyncedAt,
                lineItems: invoice.lineItems,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt,
                isSynced: !!invoice.qboInvoiceId
            })),
            totalCount,
            totalPages,
            currentPage: page,
            summary
        };

    } catch (error) {
        throw new Error(`Failed to get invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get invoice by ID
 */
const getInvoiceById = async (invoiceId: string, realmId: string): Promise<any> => {
    try {
        // Get QBO connection for this realm
        const connection = await prisma.qBOConnection.findUnique({
            where: { realmId }
        });

        if (!connection) {
            throw new Error('QuickBooks connection not found for this realm');
        }

        const invoice = await prisma.invoice.findFirst({
            where: {
                id: invoiceId,
                qboConnectionId: connection.id
            },
            include: {
                customer: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true,
                        billingLine1: true,
                        city: true,
                        state: true,
                        postalCode: true,
                        country: true
                    }
                },
                payments: {
                    select: {
                        id: true,
                        amount: true,
                        paymentDate: true,
                        paymentMethod: true,
                        status: true,
                        qboPaymentId: true
                    }
                }
            }
        });

        if (!invoice) {
            throw new Error(`Invoice with ID ${invoiceId} not found`);
        }

        return {
            ...invoice,
            isSynced: !!invoice.qboInvoiceId,
            totalPayments: invoice.payments.reduce((sum, payment) => sum + payment.amount, 0),
            outstandingAmount: invoice.total - invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
        };

    } catch (error) {
        throw new Error(`Failed to get invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Export all service functions
const invoiceSyncService = {
    syncInvoiceToQBO,
    syncAllInvoicesToQBO,
    getInvoiceSyncStatus,
    getAllInvoicesSyncStatus,
    getSyncStatistics,
    getInvoices,
    getInvoiceById
};

export default invoiceSyncService;
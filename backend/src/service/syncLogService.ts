import { prisma } from '../config/db'; 
import { SyncLogsResult } from '../types/syncLogs';

const findConnection = async (realmId: string): Promise<string> => {
    try {
        const connection = await prisma.qBOConnection.findUnique({
            where: { realmId }
        });

        if (!connection) {
            throw new Error(`QuickBooks connection not found for realm: ${realmId}`);
        }

        return connection.id;
    } catch (error) {
        console.error('Error finding QBO connection:', error);
        throw new Error(`Failed to find QBO connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get all sync logs with pagination and filtering
 */
const getSyncLogs = async (options: {
    page: number;
    limit: number;
    transactionType?: string;
    status?: string;
    operation?: string;
    realmId: string;
    dateFrom?: string;
    dateTo?: string;
    systemTransactionId?: string;
    quickbooksId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}): Promise<SyncLogsResult> => {
    try {
        const { 
            page, 
            limit, 
            transactionType, 
            status, 
            operation, 
            realmId, 
            dateFrom, 
            dateTo, 
            systemTransactionId,
            quickbooksId,
            search,
            sortBy = 'timestamp',
            sortOrder = 'desc'
        } = options;
        const skip = (page - 1) * limit;

        // Get QBO connection for this realm
        const qboConnectionId = await findConnection(realmId);

        // Build where clause
        const where: any = {
            qboConnectionId
        };

        // Filter by transaction type
        if (transactionType) {
            where.transactionType = transactionType;
        }

        // Filter by status
        if (status) {
            where.status = status;
        }

        // Filter by operation
        if (operation) {
            where.operation = operation;
        }

        // Filter by specific system transaction ID
        if (systemTransactionId) {
            where.systemTransactionId = systemTransactionId;
        }

        // Filter by specific QuickBooks ID
        if (quickbooksId) {
            where.quickbooksId = quickbooksId;
        }

        // Date range filter
        if (dateFrom || dateTo) {
            where.timestamp = {};
            if (dateFrom) where.timestamp.gte = new Date(dateFrom);
            if (dateTo) where.timestamp.lte = new Date(dateTo);
        }

        // Global search functionality
        if (search) {
            where.OR = [
                {
                    systemTransactionId: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    quickbooksId: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    errorMessage: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    errorCode: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    syncId: {
                        contains: search,
                        mode: 'insensitive'
                    }
                }
            ];
        }

        // Build orderBy clause
        let orderBy: any = {};
        
        // Map sortBy field to actual database field
        switch (sortBy) {
            case 'timestamp':
                orderBy.timestamp = sortOrder;
                break;
            case 'transactionType':
                orderBy.transactionType = sortOrder;
                break;
            case 'status':
                orderBy.status = sortOrder;
                break;
            case 'operation':
                orderBy.operation = sortOrder;
                break;
            case 'systemTransactionId':
                orderBy.systemTransactionId = sortOrder;
                break;
            case 'quickbooksId':
                orderBy.quickbooksId = sortOrder;
                break;
            case 'duration':
                orderBy.duration = sortOrder;
                break;
            case 'retryCount':
                orderBy.retryCount = sortOrder;
                break;
            case 'createdAt':
                orderBy.createdAt = sortOrder;
                break;
            case 'updatedAt':
                orderBy.updatedAt = sortOrder;
                break;
            default:
                orderBy.timestamp = 'desc'; // Default sorting
        }

        // Get total count with the same filter conditions
        const totalCount = await prisma.syncLog.count({ where });

        // Get sync logs with pagination (excluding requestPayload and responsePayload for performance)
        const syncLogsRaw = await prisma.syncLog.findMany({
            where,
            select: {
                id: true,
                syncId: true,
                transactionType: true,
                systemTransactionId: true,
                quickbooksId: true,
                status: true,
                operation: true,
                qboConnectionId: true,
                invoiceId: true,
                paymentId: true,
                errorMessage: true,
                errorCode: true,
                timestamp: true,
                startedAt: true,
                completedAt: true,
                duration: true,
                retryCount: true,
                maxRetries: true,
                nextRetryAt: true,
                createdAt: true,
                updatedAt: true,
                // Include related data
                invoice: {
                    select: {
                        docNumber: true,
                        total: true,
                        status: true
                    }
                },
                payment: {
                    select: {
                        referenceNumber: true,
                        amount: true,
                        status: true
                    }
                }
            },
            orderBy,
            skip,
            take: limit
        });

        // Map raw logs to SyncLog type
        const syncLogs = syncLogsRaw.map(log => ({
            ...log,
            invoice: log.invoice
                ? {
                    docNumber: log.invoice.docNumber ?? '',
                    total: log.invoice.total,
                    status: typeof log.invoice.status === 'string' ? log.invoice.status : String(log.invoice.status)
                    // customerName: undefined // add if needed
                }
                : null,
            payment: log.payment
                ? {
                    referenceNumber: log.payment.referenceNumber ?? '',
                    amount: log.payment.amount,
                    status: typeof log.payment.status === 'string' ? log.payment.status : String(log.payment.status)
                }
                : null
        }));

        const totalPages = Math.ceil(totalCount / limit);

        // Calculate summary statistics for this connection
        const allLogs = await prisma.syncLog.findMany({
            where: { qboConnectionId },
            select: {
                status: true,
                transactionType: true,
                duration: true,
                operation: true,
                timestamp: true
            }
        });

        const successCount = allLogs.filter(log => log.status === 'SUCCESS').length;
        const failedCount = allLogs.filter(log => log.status === 'FAILED').length;
        const pendingCount = allLogs.filter(log => log.status === 'PENDING').length;
        const inProgressCount = allLogs.filter(log => log.status === 'IN_PROGRESS').length;
        const invoiceLogs = allLogs.filter(log => log.transactionType === 'INVOICE').length;
        const paymentLogs = allLogs.filter(log => log.transactionType === 'PAYMENT').length;

        // Operation counts
        const createOperations = allLogs.filter(log => log.operation === 'CREATE').length;
        const updateOperations = allLogs.filter(log => log.operation === 'UPDATE').length;
        const deleteOperations = allLogs.filter(log => log.operation === 'DELETE').length;

        // Calculate average duration (excluding null values)
        const logsWithDuration = allLogs.filter(log => log.duration !== null);
        const averageDuration = logsWithDuration.length > 0 
            ? logsWithDuration.reduce((sum, log) => sum + (log.duration || 0), 0) / logsWithDuration.length
            : 0;

        // Recent activity (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentLogs = allLogs.filter(log => new Date(log.timestamp) >= yesterday);

        const summary = {
            totalLogs: allLogs.length,
            successCount,
            failedCount,
            pendingCount,
            inProgressCount,
            invoiceLogs,
            paymentLogs,
            createOperations,
            updateOperations,
            deleteOperations,
            averageDuration: Math.round(averageDuration),
            recentActivity: recentLogs.length,
            successRate: allLogs.length > 0 ? Math.round((successCount / allLogs.length) * 100) : 0
        };

        return {
            syncLogs,
            totalCount,
            totalPages,
            currentPage: page,
            summary
        };

    } catch (error) {
        throw new Error(`Failed to get sync logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get a specific sync log by ID
 */
const getSyncLogById = async (syncLogId: string, realmId: string) => {
    try {
        // Get QBO connection for this realm
        const qboConnectionId = await findConnection(realmId);

        const syncLog = await prisma.syncLog.findFirst({
            where: {
                id: syncLogId,
                qboConnectionId
            },
            include: {
                invoice: {
                    select: {
                        docNumber: true,
                        total: true,
                        status: true,
                    }
                },
                payment: {
                    select: {
                        referenceNumber: true,
                        amount: true,
                        status: true
                    }
                }
            }
        });

        if (!syncLog) {
            throw new Error(`Sync log not found with ID: ${syncLogId}`);
        }

        return syncLog;
    } catch (error) {
        throw new Error(`Failed to get sync log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get sync logs by transaction ID (system or QuickBooks)
 */
const getSyncLogsByTransactionId = async (transactionId: string, realmId: string) => {
    try {
        // Get QBO connection for this realm
        const qboConnectionId = await findConnection(realmId);

        const syncLogs = await prisma.syncLog.findMany({
            where: {
                qboConnectionId,
                OR: [
                    { systemTransactionId: transactionId },
                    { quickbooksId: transactionId }
                ]
            },
            include: {
                invoice: {
                    select: {
                        docNumber: true,
                        total: true,
                        status: true
                    }
                },
                payment: {
                    select: {
                        referenceNumber: true,
                        amount: true,
                        status: true
                    }
                }
            },
            orderBy: { timestamp: 'desc' }
        });

        return syncLogs;
    } catch (error) {
        throw new Error(`Failed to get sync logs by transaction ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

export default {
    getSyncLogs,
    getSyncLogById,
    getSyncLogsByTransactionId
};
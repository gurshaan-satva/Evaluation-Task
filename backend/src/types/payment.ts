// types/payment.ts

// QuickBooks Payment interfaces
export interface QBOPayment {
    Id: string;
    SyncToken: string;
    MetaData: {
        CreateTime: string;
        LastUpdatedTime: string;
    };
    TxnDate: string;
    TotalAmt: number;
    UnappliedAmt: number;
    ProcessPayment: boolean;
    CustomerRef: {
        value: string;
        name?: string;
    };
    PaymentMethodRef?: {
        value: string;
        name?: string;
    };
    DepositToAccountRef?: {
        value: string;
        name?: string;
    };
    PaymentRefNum?: string;
    PrivateNote?: string;
    LinkedTxn?: Array<{
        TxnId: string;
        TxnType: string;
        TxnLineId?: string;
    }>;
    Line?: Array<{
        Amount: number;
        LinkedTxn?: Array<{
            TxnId: string;
            TxnType: string;
            TxnLineId?: string;
        }>;
    }>;
    domain: string;
    sparse: boolean;
}

// QuickBooks Payment creation payload
export interface QBOPaymentPayload {
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
    Line?: Array<{
        Amount: number;
        LinkedTxn?: Array<{
            TxnId: string;
            TxnType: string;
        }>;
    }>;
}

// QuickBooks API Response interface for payments
export interface QBOPaymentQueryResponse {
    QueryResponse: {
        Payment?: QBOPayment[];
        startPosition?: number;
        maxResults?: number;
    };
    time: string;
}

// QuickBooks Payment creation response
export interface QBOPaymentCreateResponse {
    Payment: QBOPayment;
    time: string;
}

// Payment sync request interfaces
export interface PaymentSyncRequest {
    paymentId: string;
}

export interface BatchPaymentSyncRequest {
    limit?: number;
    paymentIds?: string[];
}

// Payment sync response interfaces
export interface PaymentSyncResponse {
    success: boolean;
    paymentId: string;
    qboPaymentId?: string;
    syncToken?: string;
    message: string;
    error?: string;
    realmId: string;
}

export interface BatchPaymentSyncResponse {
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
    realmId: string;
    hasFailures: boolean;
}

// Payment sync status interfaces
export interface PaymentSyncStatusResponse {
    payment: {
        id: string;
        referenceNumber?: string;
        amount: number;
        status: string;
        qboPaymentId?: string;
        syncStatus: string;
        lastSyncedAt?: Date;
        isSynced: boolean;
    };
    syncLogs: any[];
    lastSync?: Date;
    status: string;
}

export interface PaymentsSyncStatusResponse {
    payments: Array<{
        id: string;
        referenceNumber?: string;
        amount: number;
        status: string;
        qboPaymentId?: string;
        syncStatus: string;
        lastSyncedAt?: Date;
        createdAt: Date;
        isSynced: boolean;
    }>;
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

// Payment sync statistics interface
export interface PaymentSyncStatistics {
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
}

// Payment method mapping for QBO
export interface PaymentMethodMapping {
    CASH: string;
    CHECK: string;
    CREDIT_CARD: string;
    BANK_TRANSFER: string;
    OTHER: string;
}

// Payment status enums
export enum PaymentSyncStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED'
}

export enum PaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
    CASH = 'CASH',
    CHECK = 'CHECK',
    CREDIT_CARD = 'CREDIT_CARD',
    BANK_TRANSFER = 'BANK_TRANSFER',
    OTHER = 'OTHER'
}

import { SyncStatus } from "@prisma/client";

export interface QBOInvoiceLineItem {
    Amount: number;
    DetailType: string;
    SalesItemLineDetail?: {
        ItemRef: {
            value: string;
            name?: string;
        };
        Qty?: number;
        UnitPrice?: number;
    };
    Description?: string;
}

// QuickBooks Invoice Payload interface
export interface QBOInvoicePayload {
    CustomerRef: {
        value: string;
    };
    Line: QBOInvoiceLineItem[];
    DocNumber?: string;
    TxnDate?: string;
    DueDate?: string;
    BillAddr?: {
        Line1?: string;
        City?: string;
        Country?: string;
        CountrySubDivisionCode?: string;
        PostalCode?: string;
    };
    ShipAddr?: {
        Line1?: string;
        City?: string;
        Country?: string;
        CountrySubDivisionCode?: string;
        PostalCode?: string;
    };
    SalesTermRef?: {
        value: string;
    };
    PrivateNote?: string;
    TotalAmt?: number;
}

// QuickBooks Invoice Response interface
export interface QBOInvoiceResponse {
    QueryResponse?: any;
    Invoice?: {
        Id: string;
        DocNumber: string;
        SyncToken: string;
        MetaData: {
            CreateTime: string;
            LastUpdatedTime: string;
        };
        TotalAmt: number;
        Balance: number;
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
export interface InvoiceSyncResult {
    success: boolean;
    qboInvoiceId?: string;
    syncToken?: string;
    message: string;
    error?: string;
}

export interface BatchSyncResult {
    success: boolean;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    results: Array<{
        invoiceId: string;
        docNumber: string;
        success: boolean;
        qboInvoiceId?: string;
        message: string;
        error?: string;
    }>;
    message: string;
}

export interface InvoiceSyncStatusResult {
    invoice: any;
    syncLogs: any[];
    lastSync?: Date;
    status: SyncStatus;
}

export interface InvoicesSyncStatusResult {
    invoices: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
    summary: {
        totalInvoices: number;
        syncedInvoices: number;
        pendingInvoices: number;
        failedInvoices: number;
    };
}
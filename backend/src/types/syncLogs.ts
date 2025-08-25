// types/syncLogs.ts

export interface SyncLog {
  id: string;
  syncId: string;
  transactionType: 'INVOICE' | 'PAYMENT' | 'CUSTOMER' | 'ITEM' | 'ACCOUNT' | 'CHART_OF_ACCOUNT';
  systemTransactionId: string;
  quickbooksId: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'RETRY' | 'CANCELLED';
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
  qboConnectionId: string;
  invoiceId: string | null;
  paymentId: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  timestamp: Date;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null; // in milliseconds
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Related data
  invoice?: {
    docNumber: string;
    total: number;
    status: string;
    customerName?: string;
  } | null;
  payment?: {
    referenceNumber: string;
    amount: number;
    status: string;
    customerName?: string;
  } | null;
  // Full payload data (excluded in list view for performance)
  requestPayload?: any;
  responsePayload?: any;
}

export interface SyncLogSummary {
  totalLogs: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  inProgressCount: number;
  invoiceLogs: number;
  paymentLogs: number;
  createOperations: number;
  updateOperations: number;
  deleteOperations: number;
  averageDuration: number; // in milliseconds
  recentActivity: number; // last 24 hours
  successRate: number; // percentage
}

export interface SyncLogsResult {
  syncLogs: SyncLog[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  summary: SyncLogSummary;
}

export interface GetSyncLogsOptions {
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
}

export interface SyncLogFilters {
  transactionType: string | null;
  status: string | null;
  operation: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  systemTransactionId: string | null;
  quickbooksId: string | null;
  search: string | null;
}

export interface SyncLogSorting {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface SyncLogPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SyncLogsResponse {
  syncLogs: SyncLog[];
  pagination: SyncLogPagination;
  filters: SyncLogFilters;
  sorting: SyncLogSorting;
  summary: SyncLogSummary;
}

// Enums for better type safety
export enum TransactionType {
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  CUSTOMER = 'CUSTOMER',
  ITEM = 'ITEM',
  ACCOUNT = 'ACCOUNT',
  CHART_OF_ACCOUNT = 'CHART_OF_ACCOUNT'
}

export enum SyncStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRY = 'RETRY',
  CANCELLED = 'CANCELLED'
}

export enum OperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  READ = 'READ'
}

export const VALID_SORT_FIELDS = [
  'timestamp',
  'transactionType',
  'status',
  'operation',
  'systemTransactionId',
  'quickbooksId',
  'duration',
  'retryCount',
  'createdAt',
  'updatedAt'
] as const;

export type ValidSortField = typeof VALID_SORT_FIELDS[number];
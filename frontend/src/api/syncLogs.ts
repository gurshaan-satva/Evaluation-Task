// api/syncLogs.ts
import axiosInstance from "./axiosInstance";

interface GetSyncLogsParams {
  page?: number;
  limit?: number;
  transactionType?: string;
  status?: string;
  operation?: string;
  dateFrom?: string;
  dateTo?: string;
  systemTransactionId?: string;
  quickbooksId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const getSyncLogs = async (params: GetSyncLogsParams = {}) => {
  // Build query string with proper parameter handling
  const queryParams = new URLSearchParams();
  
  // Add all parameters if they exist
  if (params.page !== undefined) queryParams.append('page', params.page.toString());
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.transactionType) queryParams.append('transactionType', params.transactionType);
  if (params.status) queryParams.append('status', params.status);
  if (params.operation) queryParams.append('operation', params.operation);
  if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
  if (params.dateTo) queryParams.append('dateTo', params.dateTo);
  if (params.systemTransactionId) queryParams.append('systemTransactionId', params.systemTransactionId);
  if (params.quickbooksId) queryParams.append('quickbooksId', params.quickbooksId);
  if (params.search) queryParams.append('search', params.search);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  // Make the API call with query parameters
  const queryString = queryParams.toString();
  const url = `/qbo/sync-logs${queryString ? `?${queryString}` : ''}`;
  
  return await axiosInstance.get(url);
};
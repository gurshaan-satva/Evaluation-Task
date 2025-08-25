import axiosInstance from "./axiosInstance";

interface GetInvoicesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  syncStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const getInvoiceSyncStatistics = async () => {
  return await axiosInstance.get(`/qbo/invoices/sync/status`);
};

export const syncAllInvoices = async () => {
  return await axiosInstance.post(`/qbo/invoices/sync`);
};

export const getAllInvoices = async (params: GetInvoicesParams = {}) => {
  // Build query string with proper parameter handling
  const queryParams = new URLSearchParams();
  
  // Add all parameters if they exist
  if (params.page !== undefined) queryParams.append('page', params.page.toString());
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.status) queryParams.append('status', params.status);
  if (params.syncStatus) queryParams.append('syncStatus', params.syncStatus);
  if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
  if (params.dateTo) queryParams.append('dateTo', params.dateTo);
  if (params.customerId) queryParams.append('customerId', params.customerId);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  // Make the API call with query parameters
  const queryString = queryParams.toString();
  const url = `/qbo/invoices${queryString ? `?${queryString}` : ''}`;
  
  return await axiosInstance.get(url);
};



export const syncSingleInvoice = async (invoiceId: string) => {
  return await axiosInstance.post(`/qbo/invoices/sync/${invoiceId}`);
};
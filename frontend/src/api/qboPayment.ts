// api/qboPayment.ts
import axiosInstance from "./axiosInstance";

interface GetPaymentsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  syncStatus?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const getAllPayments = async (params: GetPaymentsParams = {}) => {
  // Build query string with proper parameter handling
  const queryParams = new URLSearchParams();
  
  // Add all parameters if they exist
  if (params.page !== undefined) queryParams.append('page', params.page.toString());
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.status) queryParams.append('status', params.status);
  if (params.syncStatus) queryParams.append('syncStatus', params.syncStatus);
  if (params.paymentMethod) queryParams.append('paymentMethod', params.paymentMethod);
  if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
  if (params.dateTo) queryParams.append('dateTo', params.dateTo);
  if (params.customerId) queryParams.append('customerId', params.customerId);
  if (params.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  // Make the API call with query parameters
  const queryString = queryParams.toString();
  const url = `/qbo/payments${queryString ? `?${queryString}` : ''}`;
  
  return await axiosInstance.get(url);
};

export const syncAllPayments = async () => {
  return await axiosInstance.post(`/qbo/payments/sync`);
};

export const syncSinglePayment = async (paymentId: string) => {
  return await axiosInstance.post(`/qbo/payments/sync/${paymentId}`);
};

export const getPaymentSyncStatus = async () => {
  return await axiosInstance.get(`/qbo/payments/sync/status`);
};
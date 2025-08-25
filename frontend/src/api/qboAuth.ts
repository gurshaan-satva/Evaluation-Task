// api/qboAuth.ts
import axiosInstance from "./axiosInstance";

// Authentication API calls
export const getAuthUrl = async (returnUrl?: string) => {
  const params = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
  return await axiosInstance.get(`/qbo/auth/connect${params}`);
};

export const handleCallback = async (code: string, state: string, realmId: string) => {
  return await axiosInstance.get(`/qbo/auth/callback?code=${code}&state=${state}&realmId=${realmId}`);
};

export const getConnectionStatus = async (connectionId: string) => {
  return await axiosInstance.get(`/qbo/auth/status/${connectionId}`);
};

export const refreshToken = async (connectionId: string) => {
  return await axiosInstance.post(`/qbo/auth/refresh`, { connectionId });
};

export const disconnectQBO = async (connectionId: string) => {
  return await axiosInstance.post(`/qbo/auth/disconnect`, { connectionId });
};

export const getActiveConnections = async () => {
  return await axiosInstance.get(`/qbo/auth/connections`);
};

export const testConnection = async (connectionId: string) => {
  return await axiosInstance.post(`/qbo/auth/test/${connectionId}`);
};
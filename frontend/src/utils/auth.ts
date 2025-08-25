// utils/auth.ts
export interface AuthData {
  accessToken: string;
  realmId: string;
  connectionId: string;
  companyName: string;
}

export const saveAuthData = (data: AuthData): void => {
  localStorage.setItem('qb_access_token', data.accessToken);
  localStorage.setItem('qb_realm_id', data.realmId);
  localStorage.setItem('qb_connection_id', data.connectionId);
  localStorage.setItem('qb_company_name', data.companyName);
};

export const getAuthData = (): AuthData | null => {
  const accessToken = localStorage.getItem('qb_access_token');
  const realmId = localStorage.getItem('qb_realm_id');
  const connectionId = localStorage.getItem('qb_connection_id');
  const companyName = localStorage.getItem('qb_company_name');

  if (!accessToken || !realmId || !connectionId) {
    return null;
  }

  return {
    accessToken,
    realmId,
    connectionId,
    companyName: companyName || 'Unknown Company'
  };
};

export const clearAuthData = (): void => {
  localStorage.removeItem('qb_access_token');
  localStorage.removeItem('qb_realm_id');
  localStorage.removeItem('qb_connection_id');
  localStorage.removeItem('qb_company_name');
};

export const isAuthenticated = (): boolean => {
  const authData = getAuthData();
  return authData !== null;
};

export const getCompanyName = (): string => {
  return localStorage.getItem('qb_company_name') || 'Unknown Company';
};

export const getRealmId = (): string | null => {
  return localStorage.getItem('qb_realm_id');
};

export const getConnectionId = (): string | null => {
  return localStorage.getItem('qb_connection_id');
};
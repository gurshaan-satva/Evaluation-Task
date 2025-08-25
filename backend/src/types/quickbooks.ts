// types/quickbooks.ts

export interface QBOTokenRefreshResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in?: number; // Optional - may not be present in all responses
    x_refresh_token_expires_in?: number; // Alternative field name used by some responses
    token_type?: string;
}

export interface QBOAuthTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in?: number; // Optional - may not be present in all responses
    x_refresh_token_expires_in?: number; // Alternative field name
    token_type?: string;
    realmId?: string;
}
export interface QBOAuthRequest {
  code: string;
  state: string;
  realmId: string;
}

export interface QBOConnectionData {
  id: string;
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
  isConnected: boolean;
  companyName?: string;
  connectedAt: Date;
  lastSyncAt?: Date;
}

export interface QBODisconnectRequest {
  connectionId: string;
}

export interface QBOCompanyInfo {
  QueryResponse: {
    CompanyInfo: [{
      CompanyName: string;
      CompanyAddr: {
        Line1?: string;
        City?: string;
        CountrySubDivisionCode?: string;
        PostalCode?: string;
        Country?: string;
      };
      LegalName: string;
      domain: string;
      sparse: boolean;
      Id: string;
      SyncToken: string;
      MetaData: {
        CreateTime: string;
        LastUpdatedTime: string;
      };
    }];
  };
}

export interface QBOErrorResponse {
  Fault: {
    Error: [{
      Detail: string;
      code: string;
      element?: string;
    }];
    type: string;
  };
}

export interface AuthState {
  timestamp: number;
  returnUrl?: string;
}

export interface QBOAuthUrl {
  authUrl: string;
  state: string;
}
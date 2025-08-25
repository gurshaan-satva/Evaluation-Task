export interface QBOAccount {
    Id: string;
    Name: string;
    AccountType: string;
    AccountSubType?: string;
    Classification?: string;
    CurrentBalance?: number;
    CurrentBalanceWithSubAccounts?: number;
    CurrencyRef?: {
        value: string;
        name: string;
    };
    Active: boolean;
    SubAccount: boolean;
    ParentRef?: {
        value: string;
        name: string;
    };
    SyncToken: string;
    FullyQualifiedName: string;
    domain: string;
    sparse: boolean;
    MetaData: {
        CreateTime: string;
        LastUpdatedTime: string;
    };
}

// QuickBooks API Response interface
export interface QBOQueryResponse {
    QueryResponse: {
        Account?: QBOAccount[];
        startPosition?: number;
        maxResults?: number;
    };
    time: string;
}
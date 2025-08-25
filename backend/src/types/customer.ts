export interface QBOCustomer {
    Id: string;
    Name: string;
    CompanyName?: string;
    GivenName?: string;
    FamilyName?: string;
    FullyQualifiedName?: string;
    DisplayName?: string;
    PrintOnCheckName?: string;
    Active: boolean;
    PrimaryPhone?: {
        FreeFormNumber: string;
    };
    PrimaryEmailAddr?: {
        Address: string;
    };
    WebAddr?: {
        URI: string;
    };
    DefaultTaxCodeRef?: {
        value: string;
    };
    Taxable?: boolean;
    BillAddr?: {
        Id?: string;
        Line1?: string;
        Line2?: string;
        Line3?: string;
        Line4?: string;
        Line5?: string;
        City?: string;
        Country?: string;
        CountrySubDivisionCode?: string;
        PostalCode?: string;
    };
    ShipAddr?: {
        Id?: string;
        Line1?: string;
        Line2?: string;
        Line3?: string;
        Line4?: string;
        Line5?: string;
        City?: string;
        Country?: string;
        CountrySubDivisionCode?: string;
        PostalCode?: string;
    };
    Notes?: string;
    Job?: boolean;
    BillWithParent?: boolean;
    ParentRef?: {
        value: string;
        name?: string;
    };
    Level?: number;
    SalesTermRef?: {
        value: string;
    };
    PaymentMethodRef?: {
        value: string;
    };
    Balance?: number;
    OpenBalanceDate?: string;
    BalanceWithJobs?: number;
    CurrencyRef?: {
        value: string;
        name?: string;
    };
    PreferredDeliveryMethod?: string;
    ResaleNum?: string;
    SyncToken: string;
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
        Customer?: QBOCustomer[];
        startPosition?: number;
        maxResults?: number;
    };
    time: string;
}

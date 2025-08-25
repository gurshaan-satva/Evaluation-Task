export interface QBOItem {
    Id: string;
    Name: string;
    Description?: string;
    Active: boolean;
    FullyQualifiedName?: string;
    Taxable?: boolean;
    SalesTaxIncluded?: boolean;
    PercentBased?: boolean;
    UnitPrice?: number;
    Type: 'Inventory' | 'NonInventory' | 'Service' | 'Category';
    IncomeAccountRef?: {
        value: string;
        name?: string;
    };
    ExpenseAccountRef?: {
        value: string;
        name?: string;
    };
    PurchaseDesc?: string;
    PurchaseCost?: number;
    PurchaseTaxIncluded?: boolean;
    PurchaseTaxCodeRef?: {
        value: string;
    };
    SalesTaxCodeRef?: {
        value: string;
    };
    ClassRef?: {
        value: string;
        name?: string;
    };
    Source?: string;
    ParentRef?: {
        value: string;
        name?: string;
    };
    Level?: number;
    SubItem?: boolean;
    QtyOnHand?: number;
    InvStartDate?: string;
    AssetAccountRef?: {
        value: string;
        name?: string;
    };
    ReorderPoint?: number;
    ManPartNum?: string;
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
        Item?: QBOItem[];
        startPosition?: number;
        maxResults?: number;
    };
    time: string;
}
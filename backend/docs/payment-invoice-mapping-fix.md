# Payment Invoice Mapping Fix

## Overview

This document describes the solution implemented to fix the issue where `qboInvoiceId` in the payments table was null for all payments, and the `linkedTransactions` field was using internal invoice IDs instead of QuickBooks invoice IDs.

## Problem Description

1. **Null qboInvoiceId**: The `qboInvoiceId` field in the payments table was null for all payments
2. **Incorrect TxnId**: The `linkedTransactions` field was using internal invoice IDs instead of QuickBooks invoice IDs
3. **Missing Relationship**: Payments were not properly linked to their corresponding QuickBooks invoices

## Solution

### 1. Updated Payment Sync Logic

Modified the `transformPaymentToQBO` function in `paymentSyncService.ts` to:
- Fetch the `qboInvoiceId` from the related invoice when transforming payment data
- Prioritize the QuickBooks invoice ID over stored `linkedTransactions`
- Ensure proper linking between payments and invoices

### 2. Enhanced Payment Update Process

Updated the payment sync process to:
- Store the correct `qboInvoiceId` in the payment record after successful sync
- Update `linkedTransactions` with the correct QuickBooks invoice ID
- Maintain proper relationships between payments and invoices

### 3. Utility Function for Existing Data

Created `updatePaymentInvoiceMappings` function to:
- Find payments with null `qboInvoiceId` values
- Map them to their related invoices' `qboInvoiceId` values
- Update `linkedTransactions` with correct QuickBooks invoice IDs
- Process updates in batches with concurrency control

## API Endpoints

### Update Payment Invoice Mappings
```
POST /api/v1/qbo/payments/update-invoice-mappings
```

**Description**: Updates existing payments to map `qboInvoiceId` and `linkedTransactions` from related invoices.

**Headers**:
- `Authorization: Bearer <QBO_ACCESS_TOKEN>`

**Response**:
```json
{
  "success": true,
  "message": "Updated 25 out of 30 payments with invoice mappings",
  "data": {
    "totalProcessed": 30,
    "updatedCount": 25,
    "skippedCount": 5
  }
}
```

## Usage

### 1. API Endpoint
```bash
curl -X POST http://localhost:3000/api/v1/qbo/payments/update-invoice-mappings \
  -H "Authorization: Bearer YOUR_QBO_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Script Execution
```bash
# Run the update script directly
npx ts-node src/scripts/updatePaymentInvoiceMappings.ts

# Or compile and run
npm run build
node dist/scripts/updatePaymentInvoiceMappings.js
```

## Technical Details

### Database Changes
- **payments.qboInvoiceId**: Now properly populated with QuickBooks invoice IDs
- **payments.linkedTransactions**: Updated to use QuickBooks invoice IDs instead of internal IDs

### Code Changes
1. **paymentSyncService.ts**:
   - Enhanced `transformPaymentToQBO` to fetch QBO invoice ID
   - Updated payment sync process to store correct mappings
   - Added `updatePaymentInvoiceMappings` utility function

2. **paymentSyncController.ts**:
   - Added `updatePaymentInvoiceMappings` controller function

3. **paymentSyncRoutes.ts**:
   - Added route for the new endpoint

### Error Handling
- Graceful handling of missing invoice relationships
- Batch processing with concurrency limits
- Detailed logging for troubleshooting
- Proper error responses and status codes

## Benefits

1. **Correct Invoice Linking**: Payments are now properly linked to their QuickBooks invoices
2. **Improved Data Integrity**: Consistent relationship between payments and invoices
3. **Better Sync Reliability**: More accurate payment synchronization with QuickBooks
4. **Backward Compatibility**: Existing payments can be fixed without data loss

## Monitoring

The solution includes comprehensive logging:
- Progress tracking for batch updates
- Success/failure counts
- Detailed error messages
- Performance metrics

## Future Considerations

1. **Automated Validation**: Consider adding periodic validation to ensure data consistency
2. **Migration Scripts**: For large datasets, consider running updates during maintenance windows
3. **Monitoring Alerts**: Set up alerts for sync failures or data inconsistencies

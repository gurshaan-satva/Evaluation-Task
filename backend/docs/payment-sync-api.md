# Payment Sync API Documentation

## Overview
The Payment Sync API provides endpoints for synchronizing payments between your system and QuickBooks Online. It follows the same patterns and error handling as the successful invoice sync implementation.

## Base URL
All endpoints are prefixed with `/api/v1/qbo/payments`

## Authentication
All endpoints require QuickBooks Online authentication via the `requireQBAuth` middleware.

## Endpoints

### 1. Sync Single Payment
**POST** `/api/v1/qbo/payments/:paymentId/sync`

Synchronizes a single payment to QuickBooks Online.

**Parameters:**
- `paymentId` (path): The ID of the payment to sync

**Response:**
```json
{
  "success": true,
  "message": "Payment PAY-0001 synced successfully to QuickBooks",
  "data": {
    "paymentId": "cmemcbggf000lv5w0ax6yqdgt",
    "qboPaymentId": "123",
    "syncToken": "0",
    "success": true,
    "realmId": "9341454441737033"
  }
}
```

### 2. Sync All Pending Payments
**POST** `/api/v1/qbo/payments/sync-all`

Synchronizes all pending payments to QuickBooks Online with concurrency limiting.

**Request Body:**
```json
{
  "limit": 50  // Optional: max number of payments to sync (default: 50, max: 100)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch sync completed: 3 successful, 0 failed out of 3 payments",
  "data": {
    "totalProcessed": 3,
    "successCount": 3,
    "failureCount": 0,
    "results": [
      {
        "paymentId": "cmemcbggf000lv5w0ax6yqdgt",
        "referenceNumber": "REF-1755837508622-90",
        "success": true,
        "qboPaymentId": "123",
        "message": "Payment synced successfully"
      }
    ],
    "realmId": "9341454441737033",
    "hasFailures": false
  }
}
```

### 3. Get Payment Sync Status
**GET** `/api/v1/qbo/payments/:paymentId/sync-status`

Retrieves the sync status and logs for a specific payment.

**Parameters:**
- `paymentId` (path): The ID of the payment

**Response:**
```json
{
  "success": true,
  "message": "Payment sync status retrieved successfully",
  "data": {
    "payment": {
      "id": "cmemcbggf000lv5w0ax6yqdgt",
      "referenceNumber": "REF-1755837508622-90",
      "amount": 12.96,
      "status": "COMPLETED",
      "qboPaymentId": "123",
      "syncStatus": "SUCCESS",
      "lastSyncedAt": "2025-08-22T07:30:00.000Z",
      "isSynced": true
    },
    "syncLogs": [...],
    "lastSync": "2025-08-22T07:30:00.000Z",
    "status": "SUCCESS"
  }
}
```

### 4. Get All Payments Sync Status
**GET** `/api/v1/qbo/payments/sync-status`

Retrieves sync status for all payments with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `syncStatus` (optional): Filter by sync status (`PENDING`, `IN_PROGRESS`, `SUCCESS`, `FAILED`)
- `status` (optional): Filter by payment status (`PENDING`, `COMPLETED`, `CANCELLED`)
- `dateFrom` (optional): Filter payments from date (YYYY-MM-DD)
- `dateTo` (optional): Filter payments to date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "message": "Payments sync status retrieved successfully",
  "data": {
    "payments": [...],
    "totalCount": 25,
    "totalPages": 3,
    "currentPage": 1,
    "summary": {
      "totalPayments": 25,
      "syncedPayments": 20,
      "pendingPayments": 3,
      "failedPayments": 2
    }
  }
}
```

### 5. Get Payment Sync Statistics
**GET** `/api/v1/qbo/payments/sync-statistics`

Retrieves overall sync statistics for the realm.

**Response:**
```json
{
  "success": true,
  "message": "Payment sync statistics retrieved successfully",
  "data": {
    "payments": {
      "total": 25,
      "synced": 20,
      "pending": 3,
      "failed": 2,
      "syncedPercentage": "80.00"
    },
    "syncAttempts": {
      "total": 30,
      "successful": 25,
      "failed": 5,
      "successRate": "83.33%"
    },
    "lastSyncAt": "2025-08-22T07:30:00.000Z"
  }
}
```

## Error Handling

All endpoints use consistent error handling with detailed QuickBooks Fault logging:

**Error Response Format:**
```json
{
  "success": false,
  "message": "Failed to sync payment to QuickBooks",
  "error": {
    "error": "QuickBooks API Error: Invalid Customer Reference (Code: 6240)",
    "paymentId": "cmemcbggf000lv5w0ax6yqdgt",
    "realmId": "9341454441737033"
  }
}
```

## QuickBooks Payment Payload Format

The service creates minimal QBO-compliant payloads:

**Minimum Required Format:**
```json
{
  "TotalAmt": 25.0,
  "CustomerRef": {
    "value": "1"
  }
}
```

**Full Format with Optional Fields:**
```json
{
  "TotalAmt": 25.0,
  "CustomerRef": {
    "value": "1"
  },
  "DepositToAccountRef": {
    "value": "1"
  },
  "PaymentRefNum": "PAY-0001",
  "TxnDate": "2025-08-22",
  "PrivateNote": "Payment for invoice",
  "LinkedTxn": [
    {
      "TxnId": "270",
      "TxnType": "Invoice"
    }
  ]
}
```

## Features

- ✅ **Concurrency Limiting**: Uses `p-limit` for batch operations (max 3 concurrent requests)
- ✅ **Detailed Error Logging**: Captures and logs QuickBooks Fault details
- ✅ **Sync Status Tracking**: Tracks payment sync status in database
- ✅ **Batch Processing**: Supports syncing multiple payments at once
- ✅ **Validation**: Comprehensive request validation middleware
- ✅ **Statistics**: Provides sync performance metrics
- ✅ **Customer Linking**: Automatically links payments to correct customers via invoices
- ✅ **Transaction Linking**: Links payments to QBO invoices when available

## Usage Examples

### Sync a single payment:
```bash
curl -X POST http://localhost:3000/api/v1/qbo/payments/cmemcbggf000lv5w0ax6yqdgt/sync \
  -H "Authorization: Bearer YOUR_QBO_TOKEN" \
  -H "Content-Type: application/json"
```

### Sync all pending payments:
```bash
curl -X POST http://localhost:3000/api/v1/qbo/payments/sync-all \
  -H "Authorization: Bearer YOUR_QBO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 25}'
```

### Get payment sync status:
```bash
curl -X GET http://localhost:3000/api/v1/qbo/payments/cmemcbggf000lv5w0ax6yqdgt/sync-status \
  -H "Authorization: Bearer YOUR_QBO_TOKEN"
```

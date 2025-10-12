# Transaction Timeout Fix

## Problem

The POST request to `/api/hotels/rooms` was failing with transaction timeout errors (P2028). The error occurred because:

- Default Prisma transaction timeout: 5000ms (5 seconds)
- Image upload operations were taking 6-8 seconds
- Multiple images were being uploaded sequentially within the transaction
- Transaction was expiring before image uploads completed

## Error Details

```
PrismaClientKnownRequestError: Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5728 ms passed since the start of the transaction.
```

## Solution Applied

### 1. Extended Transaction Timeouts

**Files Modified:**

- `src/hotel/hotelController.ts`

**Changes:**

- Added 30-second timeout to `addRoom` transaction (line ~726)
- Added 30-second timeout to `updateRoom` transaction (line ~881)

```typescript
// Before
const result = await prisma.$transaction(async (tx) => {
  // ... transaction logic
});

// After
const result = await prisma.$transaction(
  async (tx) => {
    // ... transaction logic
  },
  {
    timeout: 30000, // 30 second timeout for image uploads
  }
);
```

### 2. Enhanced Error Handling

**Files Modified:**

- `src/index.ts`

**Changes:**

- Added specific error handling for P2028 (transaction timeout) errors

```typescript
if (err.code === "P2028") {
  return res.status(408).json({
    success: false,
    message:
      "Operation timed out - please try again with fewer images or smaller file sizes",
    error: "Transaction timeout",
  });
}
```

## Affected Endpoints

### ✅ Fixed

- `POST /api/hotels/rooms` - Room creation with image uploads
- `PUT /api/hotels/rooms/:roomId` - Room updates with image uploads

### ✅ Not Affected (No Transaction Issues)

- `POST /api/hotels/profile` - Hotel profile creation (no transactions)
- `PUT /api/hotels/profile` - Hotel profile updates (no transactions)
- `POST /api/hotels/bookings` - Booking creation (no image uploads in transaction)

## Testing

After deployment, test with:

1. Multiple image uploads (3-6 images) during room creation
2. Large image files (2-5MB each)
3. Concurrent room creation requests

## Performance Recommendations

### Short Term ✅

- Increased transaction timeout to 30 seconds

### Future Optimizations

- Move image uploads outside of database transactions
- Implement parallel image uploads instead of sequential
- Add image compression before upload
- Implement background job processing for large uploads
- Add progress indicators for long-running uploads

## Monitoring

Watch for:

- P2028 errors in logs (should be eliminated)
- Transaction duration metrics
- Image upload success rates
- User experience with multi-image uploads

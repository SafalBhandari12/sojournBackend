# API Changes - Enhanced Booking System

## 🔄 What Changed in the Booking API

### Booking Creation Request Changes

**Endpoint:** `POST /api/hotel/bookings`

**New Required Fields Added:**

```json
{
  "hotelId": "string",
  "roomId": "string",
  "checkInDate": "string",
  "checkOutDate": "string",
  "numberOfGuests": "number",

  // ✅ NEW REQUIRED FIELDS
  "userDetails": {
    "firstName": "string (required)",
    "lastName": "string (required)",
    "email": "string (optional)",
    "dateOfBirth": "string (optional)",
    "address": "string (optional)",
    "emergencyContact": "string (optional)",
    "idProofType": "AADHAR|PASSPORT|DRIVING_LICENSE|VOTER_ID|PAN_CARD (optional)",
    "idProofNumber": "string (optional)"
  },

  "guestDetails": [
    {
      "firstName": "string (required)",
      "lastName": "string (required)",
      "age": "number (optional)",
      "idProofType": "AADHAR|PASSPORT|DRIVING_LICENSE|VOTER_ID|PAN_CARD (optional)",
      "idProofNumber": "string (optional)",
      "isPrimaryGuest": "boolean (required - exactly one must be true)",
      "specialRequests": "string (optional, max 200 chars)"
    }
  ],

  "specialRequests": "string (optional, max 500 chars)"
}
```

### Response Changes

**All booking responses now include:**

```json
{
  "specialRequests": "string",
  "guests": [
    {
      "id": "string",
      "firstName": "string",
      "lastName": "string",
      "age": "number",
      "isPrimaryGuest": "boolean",
      "specialRequests": "string",
      "idProofType": "string",
      "idProofNumber": "string (only visible to booking owner)"
    }
  ]
}
```

## 📊 Customer vs Vendor Data Access

### Customer Booking Responses

- ✅ Full access to all personal data including ID proof numbers
- ✅ Complete guest information with ID proofs
- ✅ All payment details

### Vendor Booking Responses

- ✅ Customer first name, last name, email
- ✅ Emergency contact (for safety)
- ✅ Guest names, ages, preferences
- ✅ ID proof types (for verification)
- ✅ Special requests at booking and guest level
- 🔒 Phone numbers masked (`+1234567890` → `********90`)
- 🔒 ID proof numbers hidden
- 🔒 Limited payment information

**What vendors see when confirming bookings:**

```json
{
  "bookingRef": "BK5A7B9C12",
  "status": "CONFIRMED",
  "checkInDate": "2024-03-15T00:00:00.000Z",
  "checkOutDate": "2024-03-17T00:00:00.000Z",
  "numberOfGuests": 2,
  "totalAmount": 5000,
  "specialRequests": "Room with city view, quiet floor preferred",
  "customer": {
    "phoneNumber": "********90",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "emergencyContact": "+1-555-0123",
    "hasIdProof": true,
    "idProofType": "PASSPORT"
  },
  "guests": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "age": 34,
      "isPrimaryGuest": true,
      "specialRequests": "Late check-in after 10 PM, vegetarian breakfast",
      "hasIdProof": true,
      "idProofType": "PASSPORT"
    },
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "age": 32,
      "isPrimaryGuest": false,
      "specialRequests": "Gluten-free meals, room on lower floor",
      "hasIdProof": true,
      "idProofType": "AADHAR"
    }
  ],
  "room": {
    "type": "DELUXE",
    "number": "201"
  },
  "payment": {
    "status": "SUCCESS",
    "method": "RAZORPAY"
  }
}

## ⚠️ Validation Requirements

### Required Fields

- `userDetails.firstName` (2-50 chars, letters only)
- `userDetails.lastName` (2-50 chars, letters only)
- `guestDetails[].firstName` (2-50 chars, letters only)
- `guestDetails[].lastName` (2-50 chars, letters only)
- `guestDetails[].isPrimaryGuest` (exactly one must be true)

### Optional Field Limits

- `guestDetails[].age`: 1-120
- `userDetails.dateOfBirth`: age 18-120 years
- `guestDetails[].specialRequests`: max 200 characters
- `specialRequests`: max 500 characters
- `guestDetails` array length ≤ `numberOfGuests`

## 🆔 ID Proof Types Enum

```

AADHAR
PASSPORT
DRIVING_LICENSE
VOTER_ID
PAN_CARD

```

## 📋 New Endpoints

All existing endpoints remain the same but now return enhanced data:

- `GET /api/hotel/customer/bookings` - includes guest information with full data access
- `GET /api/hotel/vendor/bookings` - includes customer/guest details (privacy protected as shown above)
- `GET /api/hotel/vendor/bookings/search/{bookingId}` - enhanced search with privacy-protected guest data
- `GET /api/hotel/bookings/{bookingId}` - role-based data access (customer gets full data, vendor gets protected data)

**GET Request Response Enhancement:**
- All booking responses now include guest array with individual guest details
- Special requests are returned at both booking level and individual guest level
- Vendor responses automatically apply privacy protection (masked phones, hidden ID numbers)
- Customer responses include all personal data including full phone numbers and ID proof numbers

## 🔒 Privacy Protection Summary

| Data Field        | Customer View | Vendor View             |
| ----------------- | ------------- | ----------------------- |
| Phone Number      | Full          | Masked (**\*\*\*\***90) |
| First/Last Name   | Full          | Full                    |
| Email             | Full          | Full                    |
| Emergency Contact | Full          | Full                    |
| ID Proof Type     | Full          | Full                    |
| ID Proof Number   | Full          | Hidden                  |
| Guest Details     | Full          | Names + Age + Requests |
| Special Requests  | Full          | Full                   |
| Payment Details   | Full          | Status only            |

---

**That's it!** The frontend just needs to send the additional fields and handle the enhanced responses.
```

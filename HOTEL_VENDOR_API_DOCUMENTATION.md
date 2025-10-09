# 🏨 Hotel Vendor Complete API Documentation

This comprehensive guide covers everything a hotel vendor needs to know about the Sojourn API - from initial signup to running a successful hotel business on the platform.

## 📖 **Table of Contents**

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Authentication Flow](#authentication-flow)
- [Vendor Registration Process](#vendor-registration-process)
- [Vendor Profile Management](#vendor-profile-management)
- [Hotel Profile Management](#hotel-profile-management)
- [Room Management](#room-management)
- [Booking Management](#booking-management)
- [Image Management](#image-management)
- [Dashboard Analytics](#dashboard-analytics)
- [Error Handling](#error-handling)
- [Frontend Implementation Guide](#frontend-implementation-guide)
- [Complete User Journey](#complete-user-journey)

---

## 🌟 **Overview**

The Sojourn platform allows hotel owners to:

- ✅ Register as vendors through OTP verification
- ✅ Submit detailed business information for admin approval
- ✅ Create and manage hotel profiles with images
- ✅ Add and manage multiple rooms with pricing
- ✅ Handle customer bookings and payments
- ✅ Track earnings and commissions
- ✅ Manage availability and seasonal pricing

**Base URL:** `https://your-api-domain.com/api`

---

## 🚀 **Getting Started**

### Prerequisites

- Valid phone number for OTP verification
- Business registration documents
- Bank account details
- Hotel images and room photos

### Test Credentials

For development/testing:

```
Phone Numbers: 9876543214, 9876543215 (bypass OTP)
These numbers automatically verify OTP without actual SMS
```

---

## 🔐 **Authentication Flow**

### 1. **Check Phone Number Availability**

**`GET /auth/check-phone/:phoneNumber`**

Check if a phone number is already registered in the system.

**Parameters:**

- `phoneNumber`: 10-digit phone number

**Response:**

```json
{
  "success": true,
  "data": {
    "exists": true,
    "message": "Phone number is already registered"
  }
}
```

### 2. **Send OTP for Registration/Login**

**`POST /auth/send-otp`**

Initiates the authentication process by sending an OTP to the phone number.

**Request Body:**

```json
{
  "phoneNumber": "9876543214"
}
```

**Response:**

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "verificationId": "verify_123456789",
    "timeout": 300
  }
}
```

### 3. **Verify OTP and Login**

**`POST /auth/verify-otp`**

Verifies the OTP and returns authentication tokens.

**Request Body:**

```json
{
  "phoneNumber": "9876543214",
  "verificationId": "verify_123456789",
  "code": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user_123",
      "phoneNumber": "9876543214",
      "role": "CUSTOMER",
      "isActive": true
    }
  }
}
```

### 4. **Resend OTP**

**`POST /auth/resend-otp`**

Resends OTP if the previous one expired or wasn't received.

**Request Body:**

```json
{
  "phoneNumber": "9876543214"
}
```

### 5. **Refresh Authentication Token**

**`POST /auth/refresh-token`**

Refreshes expired access token using refresh token.

**Headers:**

```
Authorization: Bearer <refresh_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 6. **Logout**

**`POST /auth/logout`**

Invalidates the current session and tokens.

**Headers:**

```
Authorization: Bearer <access_token>
```

---

## 🏢 **Vendor Registration Process**

### 1. **Register as Vendor**

**`POST /auth/vendor/register`**

Submit vendor application with complete business details.

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "businessName": "Grand Palace Hotels",
  "ownerName": "John Doe",
  "contactNumbers": ["+91-9876543214", "+91-9876543215"],
  "email": "john@grandpalace.com",
  "businessAddress": "123 Hotel Street, Mumbai, Maharashtra 400001",
  "googleMapsLink": "https://maps.google.com/place/grand-palace",
  "gstNumber": "27AAAAA0000A1Z5",
  "panNumber": "AAAAA0000A",
  "aadhaarNumber": "1234-5678-9012",
  "vendorType": "HOTEL",
  "bankDetails": {
    "bankName": "State Bank of India",
    "accountNumber": "123456789012",
    "ifscCode": "SBIN0000123",
    "accountHolder": "John Doe"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Vendor registration submitted successfully. Pending admin approval.",
  "data": {
    "id": "vendor_123",
    "businessName": "Grand Palace Hotels",
    "ownerName": "John Doe",
    "vendorType": "HOTEL",
    "status": "PENDING",
    "createdAt": "2024-10-08T10:30:00Z",
    "note": "Your application is pending approval. You will remain a customer until approved."
  }
}
```

### 2. **Check Vendor Application Status**

**`GET /auth/vendor/status`**

Check the current status of vendor application.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "PENDING", // PENDING | APPROVED | REJECTED | SUSPENDED
    "businessName": "Grand Palace Hotels",
    "vendorType": "HOTEL",
    "createdAt": "2024-10-08T10:30:00Z",
    "commissionRate": null
  }
}
```

**Status Types:**

- `NOT_APPLIED`: No vendor application found
- `PENDING`: Application submitted, awaiting admin review
- `APPROVED`: Application approved, vendor role activated
- `REJECTED`: Application rejected by admin
- `SUSPENDED`: Vendor account suspended

---

## 👤 **Vendor Profile Management**

### 1. **Get Current User Profile**

**`GET /auth/profile`**

Get basic user profile information.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "phoneNumber": "9876543214",
    "role": "VENDOR",
    "isActive": true,
    "createdAt": "2024-10-01T10:00:00Z"
  }
}
```

### 2. **Get Detailed User Profile**

**`GET /auth/me`**

Get comprehensive user information including vendor details.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "phoneNumber": "9876543214",
      "role": "VENDOR",
      "isActive": true
    },
    "vendor": {
      "id": "vendor_123",
      "businessName": "Grand Palace Hotels",
      "ownerName": "John Doe",
      "email": "john@grandpalace.com",
      "businessAddress": "123 Hotel Street, Mumbai",
      "vendorType": "HOTEL",
      "status": "APPROVED",
      "commissionRate": 15.0,
      "bankDetails": {
        "bankName": "State Bank of India",
        "accountHolder": "John Doe"
      }
    }
  }
}
```

### 3. **Update Vendor Profile**

**`PUT /auth/vendor/profile`**

Update vendor business information.

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "businessName": "Grand Palace Hotels & Resorts",
  "ownerName": "John Doe",
  "contactNumbers": ["+91-9876543214", "+91-9876543216"],
  "email": "contact@grandpalace.com",
  "businessAddress": "123 Hotel Street, Mumbai, Maharashtra 400001",
  "googleMapsLink": "https://maps.google.com/updated-location",
  "gstNumber": "27AAAAA0000A1Z5"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Vendor profile updated successfully",
  "data": {
    "id": "vendor_123",
    "businessName": "Grand Palace Hotels & Resorts",
    "ownerName": "John Doe",
    "contactNumbers": ["+91-9876543214", "+91-9876543216"],
    "email": "contact@grandpalace.com",
    "updatedAt": "2024-10-08T11:00:00Z"
  }
}
```

---

## 🏨 **Hotel Profile Management**

### 1. **Create Hotel Profile**

**`POST /hotels/profile`**

Create a new hotel profile with optional images.

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

```javascript
{
  // Hotel Details
  hotelName: "Grand Palace Resort",
  category: "RESORT", // RESORT | HOMESTAY | HOUSEBOAT | GUESTHOUSE
  totalRooms: 25,
  amenities: ["wifi", "pool", "spa", "parking", "restaurant", "gym"],
  cancellationPolicy: "Free cancellation up to 24 hours before check-in. 50% refund for cancellations within 24 hours.",
  checkInTime: "14:00",
  checkOutTime: "11:00",

  // Image Details (optional)
  imageType: "property", // property | room | amenity | food
  descriptions: ["Hotel exterior view", "Main lobby", "Swimming pool area"],
  isPrimary: ["true", "false", "false"]
}

// Files
images: [hotel_exterior.jpg, lobby.jpg, pool.jpg] // Multipart files
```

**Response:**

```json
{
  "success": true,
  "message": "Hotel profile created successfully",
  "data": {
    "id": "hotel_123",
    "hotelName": "Grand Palace Resort",
    "category": "RESORT",
    "totalRooms": 25,
    "amenities": ["wifi", "pool", "spa", "parking", "restaurant", "gym"],
    "cancellationPolicy": "Free cancellation up to 24 hours before check-in. 50% refund for cancellations within 24 hours.",
    "checkInTime": "14:00",
    "checkOutTime": "11:00",
    "vendor": {
      "businessName": "Grand Palace Hotels",
      "ownerName": "John Doe",
      "email": "john@grandpalace.com",
      "businessAddress": "123 Hotel Street, Mumbai"
    },
    "uploadedImages": [
      {
        "id": "img_123",
        "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/hotel_exterior.jpg",
        "thumbnailUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/tr:w-200/hotel_exterior.jpg",
        "description": "Hotel exterior view",
        "isPrimary": true,
        "imageType": "property"
      }
    ],
    "createdAt": "2024-10-08T12:00:00Z"
  }
}
```

### 2. **Get Hotel Profile**

**`GET /hotels/profile`**

Retrieve the vendor's hotel profile with all details.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Hotel profile retrieved successfully",
  "data": {
    "id": "hotel_123",
    "hotelName": "Grand Palace Resort",
    "category": "RESORT",
    "totalRooms": 25,
    "amenities": ["wifi", "pool", "spa", "parking"],
    "vendor": {
      "businessName": "Grand Palace Hotels",
      "businessAddress": "123 Hotel Street, Mumbai",
      "contactNumbers": ["+91-9876543214"]
    },
    "images": [
      {
        "id": "img_123",
        "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/hotel_exterior.jpg",
        "thumbnailUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/tr:w-200/hotel_exterior.jpg",
        "description": "Hotel exterior view",
        "isPrimary": true
      }
    ],
    "rooms": [
      {
        "id": "room_123",
        "roomType": "DELUXE",
        "roomNumber": "101",
        "capacity": 2,
        "basePrice": 150.0,
        "isAvailable": true
      }
    ],
    "totalBookings": 45,
    "activeBookings": 8
  }
}
```

### 3. **Update Hotel Profile**

**`PUT /hotels/profile`**

Update existing hotel profile information.

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body:** Same structure as create, but all fields are optional.

### 4. **Delete Hotel Image**

**`DELETE /hotels/profile/images/:imageId`**

Remove a specific image from hotel profile.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Parameters:**

- `imageId`: ID of the image to delete

**Response:**

```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

---

## 🏠 **Room Management**

### 1. **Add New Room**

**`POST /hotels/rooms`**

Add a new room to the hotel with images.

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

```javascript
{
  // Room Details
  roomType: "DELUXE", // STANDARD | DELUXE | SUITE | DORMITORY
  roomNumber: "101",
  capacity: 2,
  basePrice: 150.00,
  summerPrice: 200.00, // optional
  winterPrice: 120.00, // optional
  amenities: ["tv", "ac", "wifi", "minibar", "balcony"],

  // Image Details (optional)
  imageType: "room",
  descriptions: ["Room interior", "Bathroom", "Balcony view"],
  isPrimary: ["true", "false", "false"]
}

// Files
images: [room_interior.jpg, bathroom.jpg, balcony.jpg]
```

**Response:**

```json
{
  "success": true,
  "message": "Room added successfully",
  "data": {
    "id": "room_123",
    "roomType": "DELUXE",
    "roomNumber": "101",
    "capacity": 2,
    "basePrice": 150.0,
    "summerPrice": 200.0,
    "winterPrice": 120.0,
    "amenities": ["tv", "ac", "wifi", "minibar", "balcony"],
    "isAvailable": true,
    "uploadedImages": [
      {
        "id": "room_img_123",
        "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/rooms/room_interior.jpg",
        "thumbnailUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/rooms/tr:w-200/room_interior.jpg",
        "description": "Room interior",
        "isPrimary": true
      }
    ],
    "createdAt": "2024-10-08T13:00:00Z"
  }
}
```

### 2. **Get All Rooms**

**`GET /hotels/rooms`**

Retrieve all rooms belonging to the vendor's hotel.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Rooms retrieved successfully",
  "data": {
    "rooms": [
      {
        "id": "room_123",
        "roomType": "DELUXE",
        "roomNumber": "101",
        "capacity": 2,
        "basePrice": 150.0,
        "isAvailable": true,
        "images": [
          {
            "id": "room_img_123",
            "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/rooms/room_interior.jpg",
            "isPrimary": true
          }
        ],
        "activeBookings": 2,
        "totalEarnings": 1500.0
      }
    ],
    "totalRooms": 1,
    "availableRooms": 1,
    "occupiedRooms": 0
  }
}
```

### 3. **Update Room Details**

**`PUT /hotels/rooms/:roomId`**

Update existing room information.

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Parameters:**

- `roomId`: ID of the room to update

### 4. **Delete Room**

**`DELETE /hotels/rooms/:roomId`**

Delete a room (only if no active bookings).

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Room deleted successfully"
}
```

### 5. **Toggle Room Availability**

**`PATCH /hotels/rooms/:roomId/availability`**

Enable or disable room for bookings.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Room availability updated",
  "data": {
    "roomId": "room_123",
    "isAvailable": false
  }
}
```

---

## 📋 **Booking Management**

### 1. **Get Vendor Bookings**

**`GET /hotels/vendor/bookings`**

Retrieve all bookings for the vendor's hotel.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

```
?status=PENDING&page=1&limit=10&checkIn=2024-10-15&checkOut=2024-10-20
```

**Response:**

```json
{
  "success": true,
  "message": "Vendor bookings retrieved successfully",
  "data": {
    "bookings": [
      {
        "id": "booking_123",
        "checkInDate": "2024-10-15T00:00:00Z",
        "checkOutDate": "2024-10-17T00:00:00Z",
        "numberOfGuests": 2,
        "totalAmount": 300.0,
        "commissionAmount": 45.0,
        "vendorAmount": 255.0,
        "status": "CONFIRMED",
        "paymentStatus": "COMPLETED",
        "customer": {
          "phoneNumber": "9876543211"
        },
        "room": {
          "roomType": "DELUXE",
          "roomNumber": "101"
        },
        "booking": {
          "id": "main_booking_123",
          "razorpayOrderId": "order_xyz123",
          "razorpayPaymentId": "pay_abc456"
        },
        "createdAt": "2024-10-08T14:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "totalPages": 2
    },
    "summary": {
      "totalBookings": 15,
      "pendingBookings": 3,
      "confirmedBookings": 10,
      "cancelledBookings": 2,
      "totalEarnings": 4500.0,
      "totalCommissions": 675.0
    }
  }
}
```

### 2. **Get Booking Details**

**`GET /hotels/bookings/:bookingId`**

Get detailed information about a specific booking.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Booking details retrieved successfully",
  "data": {
    "id": "booking_123",
    "checkInDate": "2024-10-15T00:00:00Z",
    "checkOutDate": "2024-10-17T00:00:00Z",
    "numberOfGuests": 2,
    "totalAmount": 300.0,
    "status": "CONFIRMED",
    "customer": {
      "phoneNumber": "9876543211"
    },
    "hotelProfile": {
      "hotelName": "Grand Palace Resort",
      "vendor": {
        "businessName": "Grand Palace Hotels"
      }
    },
    "room": {
      "roomType": "DELUXE",
      "roomNumber": "101",
      "amenities": ["tv", "ac", "wifi"]
    },
    "booking": {
      "razorpayOrderId": "order_xyz123",
      "razorpayPaymentId": "pay_abc456",
      "commissionRate": 15.0,
      "commissionAmount": 45.0
    }
  }
}
```

### 3. **Confirm Booking**

**`PATCH /hotels/bookings/:bookingId/confirm`**

Confirm a pending booking (vendor action).

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Booking confirmed successfully",
  "data": {
    "id": "booking_123",
    "status": "CONFIRMED",
    "confirmedAt": "2024-10-08T15:00:00Z"
  }
}
```

---

## 🖼️ **Image Management**

### **Supported Image Types**

- `property`: Hotel exterior, building, general property images
- `room`: Room interiors, bed, furniture
- `amenity`: Pool, gym, spa, restaurant areas
- `food`: Restaurant menu items, dining areas

### **Image Upload Guidelines**

- **Formats:** JPG, PNG, WebP
- **Max Size:** 5MB per image
- **Recommended Dimensions:** 1200x800px minimum
- **Primary Image:** First image becomes primary by default

### **ImageKit Integration**

All images are processed and optimized automatically:

- **Original:** Full resolution image
- **Thumbnail:** `tr:w-200` (200px width)
- **Medium:** `tr:w-600` (600px width)
- **CDN:** Global delivery for fast loading

---

## 📊 **Dashboard Analytics**

### **Get Dashboard Stats**

**`GET /hotels/vendor/dashboard`**

Get comprehensive analytics for vendor dashboard.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

```
?period=month&year=2024&month=10
```

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalBookings": 45,
      "activeBookings": 8,
      "totalEarnings": 15000.0,
      "totalCommissions": 2250.0,
      "netEarnings": 12750.0,
      "averageRating": 4.2,
      "occupancyRate": 32.0
    },
    "recentBookings": [
      {
        "id": "booking_123",
        "customerPhone": "9876543211",
        "roomNumber": "101",
        "checkIn": "2024-10-15",
        "amount": 300.0,
        "status": "CONFIRMED"
      }
    ],
    "monthlyStats": {
      "labels": ["Jan", "Feb", "Mar", "Apr", "May"],
      "bookings": [12, 15, 18, 22, 25],
      "earnings": [3600, 4500, 5400, 6600, 7500]
    },
    "roomPerformance": [
      {
        "roomType": "DELUXE",
        "totalBookings": 25,
        "totalEarnings": 7500.0,
        "occupancyRate": 45.0
      }
    ]
  }
}
```

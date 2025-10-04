# Hotel Management API Routes Documentation

This document provides comprehensive documentation for all hotel management API routes, their functionalities, request/response formats, and usage examples.

## 📚 **Table of Contents**

- [Authentication](#authentication)
- [Vendor Hotel Management](#vendor-hotel-management)
- [Room Management](#room-management)
- [Public Hotel Search](#public-hotel-search)
- [Booking Management](#booking-management)
- [Payment Routes](#payment-routes)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)

---

## 🔐 **Authentication**

Most routes require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

**Roles:**

- **Vendor**: Can manage their hotel profiles, rooms, and view their bookings
- **Customer**: Can search hotels, make bookings, and manage their bookings
- **Public**: Can search hotels and view hotel details (no auth required)

---

## 🏨 **Vendor Hotel Management Routes**

### 1. **Create Hotel Profile**

**`POST /api/hotels/profile`**

Creates a new hotel profile for vendors with optional image uploads.

**Authentication:** Required (Vendor only)  
**Content-Type:** `multipart/form-data`

**Request Body:**

```javascript
{
  // Hotel Details
  hotelName: "Grand Palace Hotel",
  category: "RESORT", // RESORT | HOMESTAY | HOUSEBOAT | GUESTHOUSE
  totalRooms: 50,
  amenities: ["wifi", "pool", "spa", "parking"],
  cancellationPolicy: "Free cancellation up to 24 hours before check-in",
  checkInTime: "14:00",
  checkOutTime: "11:00",

  // Image Details (optional)
  imageType: "property", // property | room | amenity | food
  descriptions: ["Hotel lobby", "Pool area"], // Array or single string
  isPrimary: ["true", "false"] // Array or single string
}

// Files
images: [file1.jpg, file2.jpg] // Multipart files
```

**Response:**

```json
{
  "success": true,
  "message": "Hotel profile created successfully",
  "data": {
    "id": "hotel_id",
    "hotelName": "Grand Palace Hotel",
    "category": "RESORT",
    "totalRooms": 50,
    "amenities": ["wifi", "pool", "spa"],
    "cancellationPolicy": "Free cancellation up to 24 hours...",
    "checkInTime": "14:00",
    "checkOutTime": "11:00",
    "vendor": {
      "businessName": "Vendor Business Name",
      "ownerName": "Owner Name",
      "email": "vendor@email.com"
    },
    "uploadedImages": [
      {
        "id": "image_id",
        "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_id/image.jpg",
        "thumbnailUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_id/tr:w-200/image.jpg",
        "description": "Hotel lobby",
        "isPrimary": true
      }
    ]
  }
}
```

### 2. **Update Hotel Profile**

**`PUT /api/hotels/profile`**

Updates existing hotel profile with optional additional images.

**Authentication:** Required (Vendor only)  
**Content-Type:** `multipart/form-data`

**Request Body:** Same as create, but all fields are optional except what you want to update.

### 3. **Get Vendor Hotel Profile**

**`GET /api/hotels/profile`**

Retrieves the authenticated vendor's hotel profile.

**Authentication:** Required (Vendor only)

**Response:**

```json
{
  "success": true,
  "message": "Hotel profile retrieved successfully",
  "data": {
    "id": "hotel_id",
    "hotelName": "Grand Palace Hotel",
    "category": "RESORT",
    "vendor": {
      "businessName": "Vendor Business",
      "images": []
    },
    "rooms": [
      {
        "id": "room_id",
        "roomType": "DELUXE",
        "roomNumber": "101",
        "capacity": 2,
        "basePrice": 150.0
      }
    ]
  }
}
```

### 4. **Delete Hotel Image**

**`DELETE /api/hotels/profile/images/:imageId`**

Deletes a specific hotel image from both database and ImageKit.

**Authentication:** Required (Vendor only)

**Parameters:**

- `imageId`: ID of the image to delete

---

## 🏠 **Room Management Routes**

### 1. **Add New Room**

**`POST /api/hotels/rooms`**

Adds a new room to the hotel with optional room images.

**Authentication:** Required (Vendor only)  
**Content-Type:** `multipart/form-data`

**Request Body:**

```javascript
{
  // Room Details
  roomType: "DELUXE", // STANDARD | DELUXE | SUITE | DORMITORY
  roomNumber: "101",
  capacity: 2,
  basePrice: 150.00,
  summerPrice: 200.00, // optional
  winterPrice: 120.00, // optional
  amenities: ["tv", "ac", "wifi"],

  // Image Details (optional)
  imageType: "room",
  descriptions: ["Room interior", "Bathroom"],
  isPrimary: ["true", "false"]
}

// Files
images: [room1.jpg, room2.jpg]
```

**Response:**

```json
{
  "success": true,
  "message": "Room added successfully",
  "data": {
    "id": "room_id",
    "roomType": "DELUXE",
    "roomNumber": "101",
    "capacity": 2,
    "basePrice": 150.0,
    "amenities": ["tv", "ac", "wifi"],
    "uploadedImages": [
      {
        "id": "image_id",
        "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_id/rooms/image.jpg",
        "description": "Room interior",
        "isPrimary": true
      }
    ]
  }
}
```

### 2. **Update Room Details**

**`PUT /api/hotels/rooms/:roomId`**

Updates existing room details with optional additional images.

**Authentication:** Required (Vendor only)  
**Content-Type:** `multipart/form-data`

**Parameters:**

- `roomId`: ID of the room to update

### 3. **Delete Room**

**`DELETE /api/hotels/rooms/:roomId`**

Deletes a room (only if no active bookings exist).

**Authentication:** Required (Vendor only)

### 4. **Get Vendor's All Rooms**

**`GET /api/hotels/rooms`**

Retrieves all rooms belonging to the authenticated vendor.

**Authentication:** Required (Vendor only)

### 5. **Toggle Room Availability**

**`PATCH /api/hotels/rooms/:roomId/availability`**

Toggles room availability status (available/unavailable).

**Authentication:** Required (Vendor only)

---

## 🔍 **Public Hotel Search Routes**

### 1. **Search Available Hotels**

**`GET /api/hotels/search`**

Searches for hotels based on various criteria.

**Authentication:** Not required

**Query Parameters:**

```
?category=RESORT
&location=Mumbai
&checkIn=2024-01-15
&checkOut=2024-01-17
&guests=2
&minPrice=100
&maxPrice=500
&amenities=wifi,pool
&page=1
&limit=10
```

**Response:**

```json
{
  "success": true,
  "message": "Hotels retrieved successfully",
  "data": {
    "hotels": [
      {
        "id": "hotel_id",
        "hotelName": "Grand Palace Hotel",
        "category": "RESORT",
        "vendor": {
          "businessName": "Vendor Business",
          "businessAddress": "Mumbai, India",
          "images": []
        },
        "rooms": [
          {
            "id": "room_id",
            "roomType": "DELUXE",
            "capacity": 2,
            "basePrice": 150.0
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 2. **Get Hotel Details**

**`GET /api/hotels/:hotelId`**

Retrieves detailed information about a specific hotel.

**Authentication:** Not required

### 3. **Check Room Availability**

**`GET /api/hotels/:hotelId/availability`**

Checks room availability for specific dates.

**Authentication:** Not required

**Query Parameters:**

```
?checkIn=2024-01-15&checkOut=2024-01-17&guests=2
```

---

## 📋 **Booking Management Routes**

### 1. **Create Hotel Booking**

**`POST /api/hotels/bookings`**

Creates a new hotel booking for customers.

**Authentication:** Required (Customer)

**Request Body:**

```json
{
  "hotelId": "hotel_id",
  "roomId": "room_id",
  "checkInDate": "2024-01-15",
  "checkOutDate": "2024-01-17",
  "numberOfGuests": 2
}
```

**Response:**

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": "booking_id",
    "checkInDate": "2024-01-15T00:00:00Z",
    "checkOutDate": "2024-01-17T00:00:00Z",
    "numberOfGuests": 2,
    "totalAmount": 300.0,
    "status": "PENDING",
    "booking": {
      "id": "main_booking_id",
      "totalAmount": 300.0,
      "commissionAmount": 48.0
    },
    "hotelProfile": {
      "hotelName": "Grand Palace Hotel",
      "vendor": {
        "businessName": "Vendor Business"
      }
    },
    "room": {
      "roomType": "DELUXE",
      "roomNumber": "101"
    }
  }
}
```

### 2. **Get Customer Bookings**

**`GET /api/hotels/bookings`**

Retrieves all bookings for the authenticated customer.

**Authentication:** Required (Customer)

**Query Parameters:**

```
?status=PENDING&page=1&limit=10
```

### 3. **Get Vendor Bookings**

**`GET /api/hotels/vendor/bookings`**

Retrieves all bookings for the authenticated vendor's hotel.

**Authentication:** Required (Vendor)

### 4. **Get Booking Details**

**`GET /api/hotels/bookings/:bookingId`**

Retrieves detailed information about a specific booking.

**Authentication:** Required (Customer or Vendor)

### 5. **Cancel Booking**

**`PATCH /api/hotels/bookings/:bookingId/cancel`**

Cancels a booking and processes refund if payment was made.

**Authentication:** Required (Customer - booking owner)

### 6. **Confirm Booking**

**`PATCH /api/hotels/bookings/:bookingId/confirm`**

Confirms a pending booking (vendor action).

**Authentication:** Required (Vendor)

---

## 💳 **Payment Routes**

### 1. **Create Razorpay Order**

**`POST /api/hotels/bookings/:bookingId/payment/create-order`**

Creates a Razorpay payment order for a booking.

**Authentication:** Required (Customer)

**Response:**

```json
{
  "success": true,
  "message": "Payment order created successfully",
  "data": {
    "orderId": "order_razorpay_id",
    "amount": 300.0,
    "currency": "INR",
    "key": "rzp_test_key_id"
  }
}
```

### 2. **Verify Payment**

**`POST /api/hotels/bookings/:bookingId/payment/verify`**

Verifies Razorpay payment signature and updates booking status.

**Authentication:** Required (Customer)

**Request Body:**

```json
{
  "razorpay_payment_id": "pay_id",
  "razorpay_order_id": "order_id",
  "razorpay_signature": "signature"
}
```

### 3. **Process Refund**

**`POST /api/hotels/bookings/:bookingId/payment/refund`**

Processes refund for cancelled bookings.

**Authentication:** Required (Customer)

**Request Body:**

```json
{
  "refundAmount": 150.0 // optional, defaults to full amount
}
```

---

## ⚠️ **Error Handling**

All routes return consistent error responses:

```json
{
  "success": false,
  "message": "Detailed error message"
}
```

**Common HTTP Status Codes:**

- `200`: Success
- `400`: Bad Request (validation errors, business logic errors)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

---

## 📝 **Usage Examples**

### **Frontend Integration Example (React/JavaScript):**

```javascript
// Create hotel profile with images
const createHotelProfile = async (hotelData, imageFiles) => {
  const formData = new FormData();

  // Add hotel data
  Object.keys(hotelData).forEach((key) => {
    if (Array.isArray(hotelData[key])) {
      hotelData[key].forEach((item) => formData.append(key, item));
    } else {
      formData.append(key, hotelData[key]);
    }
  });

  // Add images
  imageFiles.forEach((file, index) => {
    formData.append("images", file);
    formData.append("descriptions", `Hotel image ${index + 1}`);
    formData.append("isPrimary", index === 0 ? "true" : "false");
  });

  const response = await fetch("/api/hotels/profile", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
};

// Search hotels
const searchHotels = async (searchParams) => {
  const queryString = new URLSearchParams(searchParams).toString();
  const response = await fetch(`/api/hotels/search?${queryString}`);
  return response.json();
};

// Create booking
const createBooking = async (bookingData) => {
  const response = await fetch("/api/hotels/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bookingData),
  });
  return response.json();
};
```

### **cURL Examples:**

```bash
# Search hotels
curl -X GET "http://localhost:3000/api/hotels/search?category=RESORT&location=Mumbai"

# Create booking
curl -X POST "http://localhost:3000/api/hotels/bookings" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": "hotel_id",
    "roomId": "room_id",
    "checkInDate": "2024-01-15",
    "checkOutDate": "2024-01-17",
    "numberOfGuests": 2
  }'

# Add room with images
curl -X POST "http://localhost:3000/api/hotels/rooms" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "roomType=DELUXE" \
  -F "roomNumber=101" \
  -F "capacity=2" \
  -F "basePrice=150" \
  -F "amenities=tv,ac,wifi" \
  -F "images=@room1.jpg" \
  -F "images=@room2.jpg" \
  -F "descriptions=Room interior" \
  -F "descriptions=Bathroom view"
```

---

## 🔒 **Security Features**

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Vendor/Customer/Public access levels
- **Input Validation**: Zod schema validation for all inputs
- **File Upload Security**: File type and size validation with Multer
- **Payment Security**: Razorpay signature verification
- **Transaction Safety**: Database transactions prevent race conditions
- **Booking Conflicts**: Robust conflict detection prevents double bookings

---

## 📊 **Key Features**

- ✅ **Complete CRUD Operations** for hotels and rooms
- ✅ **Image Upload Integration** with ImageKit
- ✅ **Payment Processing** with Razorpay
- ✅ **Real-time Availability** checking
- ✅ **Booking Conflict Prevention**
- ✅ **Search and Filtering** capabilities
- ✅ **Seasonal Pricing** support
- ✅ **Commission Tracking** for vendors
- ✅ **Refund Processing** for cancellations
- ✅ **Comprehensive Error Handling**

This API provides a complete hotel booking system with vendor management, customer bookings, payment processing, and image handling capabilities.

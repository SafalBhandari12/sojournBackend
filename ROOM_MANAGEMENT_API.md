# Hotel Room Management API

This documentation covers the updated room management endpoints for the hotel booking system. These endpoints have been enhanced with improved image upload handling, transaction safety, and better error reporting.

## Room Management Endpoints

### 1. Add Room

**POST** `/hotels/rooms`

Creates a new room for the vendor's hotel with optional image uploads.

#### Headers

```
Authorization: Bearer <vendor_jwt_token>
Content-Type: multipart/form-data
```

#### Request Body (multipart/form-data)

```javascript
{
  // Required Fields
  "roomType": "DELUXE",           // STANDARD | DELUXE | SUITE | DORMITORY
  "capacity": 2,                  // Number >= 1
  "basePrice": 2500,              // Number >= 0

  // Optional Fields
  "roomNumber": "101",            // String (max 50 chars)
  "summerPrice": 3000,            // Number >= 0 (June-August pricing)
  "winterPrice": 2000,            // Number >= 0 (December-February pricing)
  "amenities": ["WiFi", "AC", "TV"], // Array of strings or comma-separated string
  "imageType": "room",            // property | room | amenity | food (default: room)

  // Image Upload Fields (for multiple files)
  "descriptions": ["Room view", "Bathroom view"], // Array or single string
  "isPrimary": ["true", "false"]  // Array or single string ("true"/"false")
}

// Files: Multiple image files can be uploaded
```

#### Success Response

```json
{
  "success": true,
  "message": "Room added successfully",
  "data": {
    "id": "room_12345",
    "hotelProfileId": "hotel_67890",
    "roomType": "DELUXE",
    "roomNumber": "101",
    "capacity": 2,
    "basePrice": 2500,
    "summerPrice": 3000,
    "winterPrice": 2000,
    "amenities": ["WiFi", "AC", "TV"],
    "isAvailable": true,
    "createdAt": "2025-10-11T10:00:00.000Z",
    "updatedAt": "2025-10-11T10:00:00.000Z",
    "uploadedImages": [
      {
        "id": "img_12345",
        "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/rooms/room_101_1.jpg",
        "fileId": "file_abc123",
        "thumbnailUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/rooms/tr:w-300,h-200/room_101_1.jpg",
        "isPrimary": true,
        "description": "Room view",
        "imageType": "room"
      }
    ]
  }
}
```

#### Error Response (with partial image upload failures)

```json
{
  "success": true,
  "message": "Room added successfully with some image upload errors",
  "data": {
    "id": "room_12345",
    "roomType": "DELUXE",
    "uploadedImages": [...], // Successfully uploaded images
    "imageErrors": [
      {
        "index": 1,
        "fileName": "large_image.jpg",
        "error": "File size too large"
      }
    ]
  }
}
```

---

### 2. Get Vendor Rooms

**GET** `/hotels/rooms`

Retrieves all rooms for the authenticated vendor with pagination, images, and booking statistics.

#### Headers

```
Authorization: Bearer <vendor_jwt_token>
```

#### Query Parameters

```
page=1        // Page number (default: 1)
limit=10      // Items per page (default: 10)
```

#### Success Response

```json
{
  "success": true,
  "message": "Rooms retrieved successfully",
  "data": {
    "rooms": [
      {
        "id": "room_12345",
        "hotelProfileId": "hotel_67890",
        "roomType": "DELUXE",
        "roomNumber": "101",
        "capacity": 2,
        "basePrice": 2500,
        "summerPrice": 3000,
        "winterPrice": 2000,
        "amenities": ["WiFi", "AC", "TV"],
        "isAvailable": true,
        "activeBookingsCount": 2, // Number of active bookings (PENDING/CONFIRMED)
        "createdAt": "2025-10-11T10:00:00.000Z",
        "updatedAt": "2025-10-11T10:00:00.000Z",
        "images": [
          {
            "id": "img_12345",
            "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/rooms/room_101_1.jpg",
            "isPrimary": true,
            "description": "Room view",
            "imageType": "room",
            "uploadedAt": "2025-10-11T10:00:00.000Z"
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

---

### 3. Update Room

**PUT** `/hotels/rooms/:roomId`

Updates an existing room's details and optionally adds new images.

#### Headers

```
Authorization: Bearer <vendor_jwt_token>
Content-Type: multipart/form-data
```

#### URL Parameters

```
roomId: string (required) - The ID of the room to update
```

#### Request Body (multipart/form-data)

All fields are optional for updates:

```javascript
{
  // Optional Room Details (these update the room record)
  "roomType": "SUITE",            // STANDARD | DELUXE | SUITE | DORMITORY
  "roomNumber": "102",            // String (max 50 chars)
  "capacity": 4,                  // Number >= 1
  "basePrice": 3500,              // Number >= 0
  "summerPrice": 4000,            // Number >= 0
  "winterPrice": 3000,            // Number >= 0
  "amenities": ["WiFi", "AC", "TV", "Balcony"], // Array or comma-separated
  "isAvailable": true,            // Boolean

  // Image Upload Fields (these are for new images only)
  "imageType": "room",            // property | room | amenity | food
  "descriptions": ["Updated room view"], // Array or single string
  "isPrimary": ["true"]           // Array or single string - sets new primary image
}

// Files: New image files to upload (optional)
```

**Note**: `descriptions` and `isPrimary` are only used for new image uploads and are not stored with the room data itself. They are filtered out during room updates.

#### Success Response

```json
{
  "success": true,
  "message": "Room updated successfully",
  "data": {
    "id": "room_12345",
    "hotelProfileId": "hotel_67890",
    "roomType": "SUITE",
    "roomNumber": "102",
    "capacity": 4,
    "basePrice": 3500,
    "summerPrice": 4000,
    "winterPrice": 3000,
    "amenities": ["WiFi", "AC", "TV", "Balcony"],
    "isAvailable": true,
    "updatedAt": "2025-10-11T11:00:00.000Z",
    "uploadedImages": [
      {
        "id": "img_67890",
        "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/rooms/room_102_updated.jpg",
        "fileId": "file_def456",
        "thumbnailUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_123/rooms/tr:w-300,h-200/room_102_updated.jpg",
        "isPrimary": true,
        "description": "Updated room view",
        "imageType": "room"
      }
    ]
  }
}
```

## Key Features

### 🔒 Transaction Safety

- All room operations and image uploads are wrapped in database transactions
- Ensures data consistency even if partial operations fail
- Rollback on critical errors

### 🖼️ Enhanced Image Handling

- Multiple image upload support with individual descriptions
- Automatic primary image management (prevents conflicts)
- Detailed error reporting for failed uploads
- ImageKit integration with folder organization
- Thumbnail generation and file management

### 📊 Smart Data Exposure

- Vendor rooms endpoint shows only necessary booking statistics
- No sensitive customer data exposed
- Active booking counts for dashboard insights
- Primary images sorted first

### ⚡ Performance Optimizations

- Pagination support for large room collections
- Optimized database queries with proper indexing
- Selective data loading to reduce response size

## Error Handling

### Common Error Responses

#### Validation Errors

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "capacity",
      "message": "Room must accommodate at least 1 person"
    }
  ]
}
```

#### Authentication Errors

```json
{
  "success": false,
  "message": "Only vendors can add/update rooms"
}
```

#### Business Logic Errors

```json
{
  "success": false,
  "message": "Room number 101 already exists in this hotel"
}
```

#### Service Errors

```json
{
  "success": false,
  "message": "Image upload service error"
}
```

## Image Upload Guidelines

### Supported Formats

- JPEG, PNG, WebP
- Maximum file size: 10MB per image
- Recommended dimensions: 1200x800px minimum

### Primary Image Logic

- When adding rooms: First image is primary by default
- When updating: Set `isPrimary: ["true"]` to designate new primary
- System automatically manages primary image constraints
- Only one primary image allowed per room

### Error Scenarios

- Invalid file formats are rejected
- Oversized files fail with specific error messages
- Network issues during upload are captured and reported
- Partial failures allow room creation/update to succeed

## Implementation Notes

### Security

- JWT authentication required for all endpoints
- Vendor ownership validation for room operations
- File upload validation and sanitization

### Database Relationships

- Rooms belong to Hotel Profiles
- Hotel Profiles belong to Vendors
- Images are linked to both Vendors and Rooms
- Booking statistics calculated in real-time

### Performance Considerations

- Use pagination for large room collections
- Images are served via CDN (ImageKit)
- Database queries optimized with proper joins
- Lazy loading for non-critical data

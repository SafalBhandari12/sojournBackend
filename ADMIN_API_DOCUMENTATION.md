# Sojourn Admin API Documentation

This document provides comprehensive information about the Sojourn Multi-Vendor Platform Admin API endpoints. Use this documentation to build admin frontend interfaces.

## 🔐 Authentication

All admin routes require authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## 📋 Base URL

```
http://localhost:3000/api/auth
```

## 🎯 Admin Routes Overview

### 1. Vendor Management

- Get all vendors for review
- Approve vendor applications
- Reject vendor applications
- Suspend vendor accounts

### 2. User Management

- Get all users
- Assign admin roles
- Revoke admin roles
- Toggle user account status (activate/deactivate)

### 3. Admin Profile Management

- Update admin profile information

---

## 📖 Detailed API Endpoints

### 🏢 Vendor Management

#### 1. Get All Vendors for Admin Review

**Endpoint:** `GET /admin/vendors`  
**Access:** Admin only  
**Description:** Retrieve all vendor applications for admin review with filtering and pagination

**Query Parameters:**

- `status` (optional): Filter by vendor status (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`)
- `vendorType` (optional): Filter by vendor type (`HOTEL`, `ADVENTURE`, `TRANSPORT`, `MARKET`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Sample Request:**

```bash
GET /api/auth/admin/vendors?status=PENDING&page=1&limit=5
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Sample Response:**

```json
{
  "success": true,
  "data": {
    "vendors": [
      {
        "id": "vendor_123",
        "userId": "user_456",
        "businessName": "Himalayan Adventure Co.",
        "ownerName": "John Doe",
        "contactNumbers": ["+977-9841234567", "+977-9841234568"],
        "email": "john@himalayanadventure.com",
        "businessAddress": "Thamel, Kathmandu, Nepal",
        "googleMapsLink": "https://maps.google.com/...",
        "gstNumber": "GST123456789",
        "panNumber": "PAN123456789",
        "aadhaarNumber": "1234-5678-9012",
        "vendorType": "ADVENTURE",
        "status": "PENDING",
        "commissionRate": 15.0,
        "createdAt": "2024-10-08T10:30:00.000Z",
        "updatedAt": "2024-10-08T10:30:00.000Z",
        "user": {
          "phoneNumber": "9876543214",
          "createdAt": "2024-10-07T15:20:00.000Z"
        },
        "bankDetails": {
          "id": "bank_789",
          "accountHolderName": "John Doe",
          "accountNumber": "1234567890",
          "bankName": "Nepal Bank Limited",
          "ifscCode": "NBL0001234",
          "branchName": "Thamel Branch"
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "pages": 5
    }
  }
}
```

#### 2. Approve Vendor Application

**Endpoint:** `PUT /admin/vendor/:vendorId/approve`  
**Access:** Admin only  
**Description:** Approve a vendor application and change user role to VENDOR

**Path Parameters:**

- `vendorId`: The ID of the vendor to approve

**Sample Request:**

```bash
PUT /api/auth/admin/vendor/vendor_123/approve
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Sample Response:**

```json
{
  "success": true,
  "message": "Vendor approved successfully. User role updated to VENDOR.",
  "data": {
    "id": "vendor_123",
    "userId": "user_456",
    "businessName": "Himalayan Adventure Co.",
    "status": "APPROVED",
    "vendorType": "ADVENTURE",
    "createdAt": "2024-10-08T10:30:00.000Z",
    "updatedAt": "2024-10-08T11:45:00.000Z",
    "user": {
      "id": "user_456",
      "phoneNumber": "9876543214",
      "role": "VENDOR",
      "isActive": true
    }
  }
}
```

#### 3. Reject Vendor Application

**Endpoint:** `PUT /admin/vendor/:vendorId/reject`  
**Access:** Admin only  
**Description:** Reject a vendor application and revert user role to CUSTOMER

**Path Parameters:**

- `vendorId`: The ID of the vendor to reject

**Sample Request:**

```bash
PUT /api/auth/admin/vendor/vendor_123/reject
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Sample Response:**

```json
{
  "success": true,
  "message": "Vendor rejected successfully. User role reverted to CUSTOMER.",
  "data": {
    "id": "vendor_123",
    "userId": "user_456",
    "businessName": "Himalayan Adventure Co.",
    "status": "REJECTED",
    "vendorType": "ADVENTURE",
    "createdAt": "2024-10-08T10:30:00.000Z",
    "updatedAt": "2024-10-08T11:50:00.000Z",
    "user": {
      "id": "user_456",
      "phoneNumber": "9876543214",
      "role": "CUSTOMER",
      "isActive": true
    }
  }
}
```

#### 4. Suspend Vendor Account

**Endpoint:** `PUT /admin/vendor/:vendorId/suspend`  
**Access:** Admin only  
**Description:** Suspend a vendor account and revert user role to CUSTOMER

**Path Parameters:**

- `vendorId`: The ID of the vendor to suspend

**Sample Request:**

```bash
PUT /api/auth/admin/vendor/vendor_123/suspend
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Sample Response:**

```json
{
  "success": true,
  "message": "Vendor suspended successfully. User role reverted to CUSTOMER.",
  "data": {
    "id": "vendor_123",
    "userId": "user_456",
    "businessName": "Himalayan Adventure Co.",
    "status": "SUSPENDED",
    "vendorType": "ADVENTURE",
    "createdAt": "2024-10-08T10:30:00.000Z",
    "updatedAt": "2024-10-08T12:00:00.000Z",
    "user": {
      "id": "user_456",
      "phoneNumber": "9876543214",
      "role": "CUSTOMER",
      "isActive": true
    }
  }
}
```

---

### 👥 User Management

#### 1. Get All Users

**Endpoint:** `GET /admin/users`  
**Access:** Admin only  
**Description:** Retrieve all users with filtering and pagination

**Query Parameters:**

- `role` (optional): Filter by user role (`CUSTOMER`, `VENDOR`, `ADMIN`)
- `isActive` (optional): Filter by account status (`true`, `false`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Sample Request:**

```bash
GET /api/auth/admin/users?role=VENDOR&isActive=true&page=1&limit=5
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Sample Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_456",
        "phoneNumber": "9876543214",
        "role": "VENDOR",
        "isActive": true,
        "createdAt": "2024-10-07T15:20:00.000Z",
        "updatedAt": "2024-10-08T11:45:00.000Z",
        "vendorProfile": {
          "businessName": "Himalayan Adventure Co.",
          "status": "APPROVED",
          "vendorType": "ADVENTURE"
        },
        "adminProfile": null
      },
      {
        "id": "user_789",
        "phoneNumber": "9876543215",
        "role": "VENDOR",
        "isActive": true,
        "createdAt": "2024-10-06T10:15:00.000Z",
        "updatedAt": "2024-10-07T14:30:00.000Z",
        "vendorProfile": {
          "businessName": "Hotel Paradise",
          "status": "APPROVED",
          "vendorType": "HOTEL"
        },
        "adminProfile": null
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "pages": 3
    }
  }
}
```

#### 2. Assign Admin Role

**Endpoint:** `PUT /admin/user/:userId/assign-admin`  
**Access:** Admin only  
**Description:** Assign admin role to a user and create admin profile

**Path Parameters:**

- `userId`: The ID of the user to make admin

**Request Body:**

```json
{
  "fullName": "Jane Smith",
  "email": "jane.smith@sojourn.com",
  "permissions": ["MANAGE_VENDORS", "MANAGE_USERS", "MANAGE_BOOKINGS"]
}
```

**Sample Request:**

```bash
PUT /api/auth/admin/user/user_999/assign-admin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "fullName": "Jane Smith",
  "email": "jane.smith@sojourn.com",
  "permissions": ["MANAGE_VENDORS", "MANAGE_USERS"]
}
```

**Sample Response:**

```json
{
  "success": true,
  "message": "Admin role assigned successfully",
  "data": {
    "user": {
      "id": "user_999",
      "phoneNumber": "9876543220",
      "role": "ADMIN",
      "isActive": true,
      "createdAt": "2024-10-05T08:00:00.000Z",
      "updatedAt": "2024-10-08T12:15:00.000Z"
    },
    "adminProfile": {
      "id": "admin_555",
      "userId": "user_999",
      "fullName": "Jane Smith",
      "email": "jane.smith@sojourn.com",
      "permissions": ["MANAGE_VENDORS", "MANAGE_USERS"],
      "createdAt": "2024-10-08T12:15:00.000Z",
      "updatedAt": "2024-10-08T12:15:00.000Z"
    }
  }
}
```

#### 3. Revoke Admin Role

**Endpoint:** `PUT /admin/user/:userId/revoke-admin`  
**Access:** Admin only  
**Description:** Revoke admin role from a user and delete admin profile

**Path Parameters:**

- `userId`: The ID of the admin user to demote

**Sample Request:**

```bash
PUT /api/auth/admin/user/user_999/revoke-admin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Sample Response:**

```json
{
  "success": true,
  "message": "Admin role revoked successfully. User role set to CUSTOMER.",
  "data": {
    "id": "user_999",
    "phoneNumber": "9876543220",
    "role": "CUSTOMER",
    "isActive": true,
    "createdAt": "2024-10-05T08:00:00.000Z",
    "updatedAt": "2024-10-08T12:30:00.000Z"
  }
}
```

#### 4. Toggle User Account Status

**Endpoint:** `PUT /admin/user/:userId/toggle-status`  
**Access:** Admin only  
**Description:** Activate or deactivate a user account

**Path Parameters:**

- `userId`: The ID of the user to activate/deactivate

**Request Body:**

```json
{
  "isActive": false
}
```

**Sample Request (Deactivate):**

```bash
PUT /api/auth/admin/user/user_999/toggle-status
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isActive": false
}
```

**Sample Response:**

```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "id": "user_999",
    "phoneNumber": "9876543220",
    "role": "CUSTOMER",
    "isActive": false,
    "createdAt": "2024-10-05T08:00:00.000Z",
    "updatedAt": "2024-10-08T12:45:00.000Z"
  }
}
```

---

### 👨‍💼 Admin Profile Management

#### 1. Update Admin Profile

**Endpoint:** `PUT /admin/profile`  
**Access:** Admin only  
**Description:** Update current admin's profile information

**Request Body:**

```json
{
  "fullName": "John Admin Updated",
  "email": "john.admin.updated@sojourn.com",
  "permissions": [
    "MANAGE_VENDORS",
    "MANAGE_USERS",
    "MANAGE_BOOKINGS",
    "MANAGE_REPORTS"
  ]
}
```

**Sample Request:**

```bash
PUT /api/auth/admin/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "fullName": "John Admin Updated",
  "email": "john.admin.updated@sojourn.com",
  "permissions": ["MANAGE_VENDORS", "MANAGE_USERS", "MANAGE_BOOKINGS"]
}
```

**Sample Response:**

```json
{
  "success": true,
  "message": "Admin profile updated successfully",
  "data": {
    "id": "admin_123",
    "userId": "user_admin_001",
    "fullName": "John Admin Updated",
    "email": "john.admin.updated@sojourn.com",
    "permissions": ["MANAGE_VENDORS", "MANAGE_USERS", "MANAGE_BOOKINGS"],
    "createdAt": "2024-10-01T09:00:00.000Z",
    "updatedAt": "2024-10-08T13:00:00.000Z"
  }
}
```

---

## 🚨 Error Responses

All endpoints return consistent error responses:

### 401 Unauthorized

```json
{
  "success": false,
  "message": "User not authenticated"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Access denied. Admin role required."
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "User not found"
}
```

### 400 Bad Request

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "fullName",
      "message": "Full name is required"
    }
  ]
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 🎨 Frontend Implementation Guidelines

### Key Features to Implement:

1. **Admin Dashboard**

   - Statistics overview (total users, vendors, pending applications)
   - Quick action buttons for common tasks

2. **Vendor Management Section**

   - Table with filters for status and vendor type
   - Action buttons for approve/reject/suspend
   - Detailed vendor profile view modal

3. **User Management Section**

   - User listing with role filters
   - Admin assignment/revocation controls
   - Account activation/deactivation toggles

4. **Admin Profile Section**
   - Editable profile form
   - Permission management interface

### Recommended UI Components:

- **Tables** with sorting, filtering, and pagination
- **Modal dialogs** for detailed views and confirmations
- **Toast notifications** for success/error messages
- **Role badges** to display user roles visually
- **Status indicators** for vendor application status
- **Action buttons** with appropriate colors (green for approve, red for reject/suspend)

### Security Considerations:

- Store JWT tokens securely (httpOnly cookies recommended)
- Implement token refresh mechanism
- Show confirmation dialogs for destructive actions
- Validate admin permissions on the frontend
- Handle token expiration gracefully

### State Management:

- Maintain user authentication state
- Cache vendor and user lists with refresh capabilities
- Handle loading states for better UX
- Implement optimistic updates where appropriate

---

## 📱 Mobile Responsiveness

Ensure the admin interface works well on:

- Desktop (primary focus)
- Tablet (important for admins on the go)
- Mobile (basic functionality for urgent actions)

## 🔄 Real-time Updates

Consider implementing:

- WebSocket connections for real-time notifications
- Auto-refresh for pending vendor applications
- Live updates when other admins make changes

---

_This documentation provides all the information needed to build a comprehensive admin frontend for the Sojourn Multi-Vendor Platform._

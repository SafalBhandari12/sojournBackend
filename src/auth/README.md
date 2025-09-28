# Sojourn Authentication System

A comprehensive authentication system for the Sojourn multi-vendor platform with OTP-based authentication using MessageCentral service.

## 🚀 Features

### 🔐 **Authentication**

- **OTP-based Authentication** using MessageCentral API
- **JWT Token Management** with refresh tokens
- **Role-based Access Control** (Admin, Vendor, Customer)
- **Phone Number Verification** (Indian numbers)

### 👥 **User Management**

- **Multi-role System** (Customer, Vendor, Admin)
- **Profile Management** for all user types
- **Vendor Registration** and approval workflow
- **Admin Panel** for vendor management

### 🛡️ **Security Features**

- **Rate Limiting** for API endpoints
- **Request Validation** and sanitization
- **JWT Token Security** with expiry management
- **OTP Attempt Limiting** (max 3 attempts)
- **Phone Number Verification** only

## 📁 **Project Structure**

```
src/auth/
├── authRoutes.ts          # Authentication routes
├── authController.ts      # Main authentication logic
├── otpService.ts         # MessageCentral OTP integration
├── utils.ts              # Utility functions
├── index.ts              # Module exports
└── README.md             # This file

src/middleware/
├── auth.ts               # Authentication middleware
└── validation.ts         # Request validation middleware
```

## 🔌 **API Endpoints**

### **Public Routes (No Authentication)**

#### Send OTP

```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "phoneNumber": "9876543210"
}
```

#### Verify OTP

```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "9876543210",
  "verificationId": "20",
  "code": "1234"
}
```

#### Resend OTP

```http
POST /api/auth/resend-otp
Content-Type: application/json

{
  "phoneNumber": "9876543210"
}
```

### **Protected Routes (Requires JWT Token)**

#### Get User Profile

```http
GET /api/auth/profile
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Update Profile

```http
PUT /api/auth/profile
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "role": "VENDOR"
}
```

#### Register as Vendor

```http
POST /api/auth/vendor/register
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "businessName": "Kashmir Tours & Travels",
  "ownerName": "John Doe",
  "contactNumbers": ["9876543210"],
  "email": "john@kashmir-tours.com",
  "businessAddress": "Dal Lake, Srinagar, Kashmir",
  "vendorType": "HOTEL",
  "bankDetails": {
    "accountNumber": "1234567890",
    "ifscCode": "SBIN0001234",
    "bankName": "State Bank of India",
    "branchName": "Srinagar Branch",
    "accountHolder": "John Doe"
  }
}
```

### **Admin Routes (Admin Only)**

#### Get All Vendors

```http
GET /api/auth/admin/vendors?status=PENDING&page=1&limit=10
Authorization: Bearer ADMIN_JWT_TOKEN
```

#### Approve Vendor

```http
PUT /api/auth/admin/vendor/{vendorId}/approve
Authorization: Bearer ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "commissionRate": 15.0
}
```

## 🔧 **Environment Variables**

Add these to your `.env` file:

```env
# Database
DATABASE_URL="your-postgres-connection-string"

# MessageCentral OTP Service
CUSTOMER_ID="C-BEEDC8FDA85247F"
AUTH_TOKEN="your-messagecentral-jwt-token"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Application Configuration
NODE_ENV="development"
PORT=3000

# OTP Configuration
OTP_EXPIRY_MINUTES=2
MAX_OTP_ATTEMPTS=3

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚦 **Usage in Express App**

```javascript
const express = require("express");
const { authRoutes, initializeAuth } = require("./src/auth");

const app = express();

// Initialize authentication module
initializeAuth();

// Use authentication routes
app.use("/api/auth", authRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

## 🎯 **Authentication Flow**

### **1. User Registration/Login Flow**

```
1. User enters phone number
2. System sends OTP via MessageCentral
3. User enters OTP code
4. System validates OTP with MessageCentral
5. JWT token generated and returned
6. User authenticated for further requests
```

### **2. Vendor Registration Flow**

```
1. User authenticates with phone + OTP
2. User submits vendor registration details
3. Vendor profile created with PENDING status
4. Admin reviews and approves/rejects
5. Approved vendors can access vendor features
```

### **3. Token Usage**

```javascript
// Include in request headers
Authorization: Bearer YOUR_JWT_TOKEN

// Token contains:
{
  "userId": "user_id",
  "role": "CUSTOMER|VENDOR|ADMIN",
  "exp": 1234567890
}
```

## 🛡️ **Security Considerations**

### **OTP Security**

- ✅ 60-second expiry (configurable)
- ✅ Maximum 3 attempts per OTP
- ✅ Phone number verification required
- ✅ Rate limiting on OTP requests

### **JWT Security**

- ✅ Secure secret key (change in production)
- ✅ 7-day expiry (configurable)
- ✅ Role-based access control
- ✅ Token validation on each request

### **API Security**

- ✅ Request validation and sanitization
- ✅ Rate limiting (100 requests per 15 minutes)
- ✅ CORS protection (configure as needed)
- ✅ SQL injection protection via Prisma

## 🔍 **Error Handling**

All API responses follow this format:

### Success Response

```json
{
  "success": true,
  "message": "Success message",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "errors": { ... } // Optional validation errors
}
```

## 📊 **OTP Service Integration**

### **MessageCentral Configuration**

The system automatically configures MessageCentral settings in the database:

```javascript
{
  "serviceName": "MessageCentral",
  "baseUrl": "https://cpaas.messagecentral.com",
  "customerId": "C-BEEDC8FDA85247F",
  "authToken": "your-jwt-token",
  "countryCode": "91",
  "flowType": "SMS",
  "defaultTimeout": 60,
  "maxAttempts": 3
}
```

### **OTP Statistics**

Track OTP usage with built-in analytics:

```javascript
const { OTPService } = require("./src/auth");

const stats = await OTPService.getOTPStats();
console.log(stats);
// Output:
// {
//   total: 100,
//   verified: 85,
//   failed: 15,
//   successRate: "85.00"
// }
```

## 🛠️ **Development & Testing**

### **Install Dependencies**

```bash
npm install @prisma/client jsonwebtoken node-fetch
npm install -D @types/node @types/jsonwebtoken
```

### **Run Prisma Migrations**

```bash
npx prisma generate
npx prisma db push
```

### **Test OTP Flow**

```bash
# Send OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"9876543210"}'

# Verify OTP
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"9876543210","verificationId":"20","code":"1234"}'
```

## 🎉 **Ready to Use!**

Your authentication system is now ready! The system supports:

- ✅ **OTP-based authentication** with MessageCentral
- ✅ **Multi-vendor registration** and management
- ✅ **Role-based access control** for all user types
- ✅ **Secure JWT token management**
- ✅ **Complete admin panel** for vendor approval
- ✅ **Rate limiting and security** features
- ✅ **Indian phone number validation**
- ✅ **Scalable and production-ready**

The authentication system integrates perfectly with your Prisma schema and supports all the vendor onboarding requirements for your Sojourn platform!

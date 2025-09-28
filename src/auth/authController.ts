import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

const prisma = new PrismaClient();

// ================================
// ZOD VALIDATION SCHEMAS
// ================================

// Phone number schema
const phoneNumberSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone number must be exactly 10 digits");

// OTP code schema
const otpCodeSchema = z
  .string()
  .regex(/^\d{4,6}$/, "OTP code must be 4-6 digits");

// Send OTP validation schema
const sendOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

// Verify OTP validation schema
const verifyOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
  verificationId: z.string().min(1, "Verification ID is required"),
  code: otpCodeSchema,
});

// Resend OTP validation schema
const resendOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

// Vendor registration schema
const vendorRegistrationSchema = z.object({
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters"),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
  contactNumbers: z
    .array(phoneNumberSchema)
    .min(1, "At least one contact number is required"),
  email: z.string().email("Invalid email format").optional(),
  businessAddress: z
    .string()
    .min(10, "Business address must be at least 10 characters"),
  googleMapsLink: z.string().url("Invalid Google Maps link").optional(),
  gstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST number format"
    )
    .optional(),
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format")
    .optional(),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, "Aadhaar number must be 12 digits")
    .optional(),
  vendorType: z.enum([
    "HOTEL",
    "ADVENTURE",
    "TRANSPORT",
    "LOCAL_MARKET",
    "OTHER",
  ]),
  bankDetails: z
    .object({
      accountNumber: z
        .string()
        .min(8, "Account number must be at least 8 digits"),
      ifscCode: z
        .string()
        .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
      bankName: z.string().min(2, "Bank name is required"),
      branchName: z.string().min(2, "Branch name is required"),
      accountHolder: z.string().min(2, "Account holder name is required"),
    })
    .optional(),
});

// Refresh token schema
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Admin assignment schema
const adminAssignmentSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .optional(),
  email: z.string().email("Invalid email format").optional(),
  permissions: z.array(z.string()).optional(),
});

// User status toggle schema
const toggleStatusSchema = z.object({
  isActive: z.boolean(),
});

// Admin profile update schema
const adminProfileUpdateSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .optional(),
  email: z.string().email("Invalid email format").optional(),
  permissions: z.array(z.string()).optional(),
});

class AuthController {
  // ================================
  // OTP MANAGEMENT
  // ================================

  /**
   * Send OTP to phone number using MessageCentral
   */
  sendOTP = async (req: Request, res: Response) => {
    try {
      // Validate request body using Zod safeParse
      const validationResult = sendOTPSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { phoneNumber } = validationResult.data;

      // Check if there's a recent active OTP
      const existingOTP = await prisma.oTP.findFirst({
        where: {
          phoneNumber,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingOTP) {
        return res.status(429).json({
          success: false,
          message: "OTP already sent. Please wait before requesting again.",
        });
      }

      // Get OTP service configuration
      const config = await prisma.oTPServiceConfig.findFirst({
        where: { isActive: true },
      });

      if (!config) {
        return res.status(500).json({
          success: false,
          message: "OTP service not configured",
        });
      }

      // Call MessageCentral Send OTP API
      const otpResponse = await fetch(
        `${config.baseUrl}/verification/v3/send?countryCode=${config.countryCode}&customerId=${config.customerId}&flowType=${config.flowType}&mobileNumber=${phoneNumber}`,
        {
          method: "POST",
          headers: {
            authToken: config.authToken,
          },
        }
      );

      const otpResult = (await otpResponse.json()) as any;

      if (otpResult.responseCode === 200) {
        // Find or create user
        let user = await prisma.user.findUnique({
          where: { phoneNumber },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              phoneNumber,
              role: "CUSTOMER",
            },
          });
        }

        // Store OTP record
        await prisma.oTP.create({
          data: {
            userId: user.id,
            phoneNumber: otpResult.data.mobileNumber,
            verificationId: otpResult.data.verificationId,
            expiresAt: new Date(
              Date.now() + parseInt(otpResult.data.timeout) * 1000
            ),
          },
        });

        return res.status(200).json({
          success: true,
          message: "OTP sent successfully",
          data: {
            verificationId: otpResult.data.verificationId,
            timeout: otpResult.data.timeout,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to send OTP",
          error: otpResult.message,
        });
      }
    } catch (error) {
      console.error("Send OTP Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Verify OTP and login/register user
   */
  verifyOTP = async (req: Request, res: Response) => {
    try {
      // Validate request body using Zod safeParse
      const validationResult = verifyOTPSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { verificationId, code, phoneNumber } = validationResult.data;

      // Find OTP record
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          verificationId: verificationId.toString(),
          phoneNumber,
          isUsed: false,
        },
        include: { user: true },
      });

      if (!otpRecord) {
        return res.status(404).json({
          success: false,
          message: "Invalid verification ID or OTP already used",
        });
      }

      // Check if OTP expired
      if (otpRecord.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired",
        });
      }

      // Check max attempts
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        return res.status(429).json({
          success: false,
          message: "Maximum OTP attempts exceeded",
        });
      }

      // Get OTP service configuration
      const config = await prisma.oTPServiceConfig.findFirst({
        where: { isActive: true },
      });

      if (!config) {
        return res.status(500).json({
          success: false,
          message: "OTP service not configured",
        });
      }

      // Call MessageCentral Validate OTP API
      const validateResponse = await fetch(
        `${config.baseUrl}/verification/v3/validateOtp?countryCode=${config.countryCode}&mobileNumber=${phoneNumber}&verificationId=${verificationId}&customerId=${config.customerId}&code=${code}`,
        {
          method: "GET",
          headers: {
            authToken: config.authToken,
          },
        }
      );

      const validateResult = (await validateResponse.json()) as any;

      if (
        validateResult.responseCode === 200 &&
        validateResult.data.verificationStatus === "VERIFICATION_COMPLETED"
      ) {
        // Mark OTP as verified
        await prisma.oTP.update({
          where: { id: otpRecord.id },
          data: {
            isVerified: true,
            isUsed: true,
            verifiedAt: new Date(),
          },
        });

        // Generate JWT token
        const token = jwt.sign(
          { userId: otpRecord.user.id, role: otpRecord.user.role },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "7d" }
        );

        return res.status(200).json({
          success: true,
          message: "OTP verified successfully",
          data: {
            token,
            user: {
              id: otpRecord.user.id,
              phoneNumber: otpRecord.user.phoneNumber,
              role: otpRecord.user.role,
              isActive: otpRecord.user.isActive,
            },
          },
        });
      } else {
        // Increment attempt count
        await prisma.oTP.update({
          where: { id: otpRecord.id },
          data: {
            attempts: { increment: 1 },
          },
        });

        return res.status(400).json({
          success: false,
          message: "Invalid OTP code",
          attemptsLeft: otpRecord.maxAttempts - (otpRecord.attempts + 1),
        });
      }
    } catch (error) {
      console.error("Verify OTP Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Resend OTP to phone number
   */
  resendOTP = async (req: Request, res: Response) => {
    try {
      // Validate request body using Zod safeParse
      const validationResult = resendOTPSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { phoneNumber } = validationResult.data;

      // Mark previous OTP as used
      await prisma.oTP.updateMany({
        where: {
          phoneNumber,
          isUsed: false,
        },
        data: { isUsed: true },
      });

      // Send new OTP (reuse sendOTP logic)
      return this.sendOTP(req, res);
    } catch (error) {
      console.error("Resend OTP Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // ================================
  // USER PROFILE MANAGEMENT
  // ================================

  /**
   * Get current user profile
   */
  getProfile = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Get Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Get detailed user profile with role-specific data
   */
  getDetailedProfile = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          vendorProfile: {
            include: {
              bankDetails: true,
              hotelProfile: true,
              adventureProfile: true,
              transportProfile: true,
              marketProfile: true,
            },
          },
          adminProfile: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Get Detailed Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Logout user (invalidate session)
   */
  logout = async (req: AuthRequest, res: Response) => {
    try {
      // In a more complex setup, you'd maintain a blacklist of tokens
      // For now, we'll just send a success response
      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // ================================
  // VENDOR MANAGEMENT
  // ================================

  /**
   * Register as vendor
   */
  registerVendor = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Validate request body using Zod safeParse
      const validationResult = vendorRegistrationSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const {
        businessName,
        ownerName,
        contactNumbers,
        email,
        businessAddress,
        googleMapsLink,
        gstNumber,
        panNumber,
        aadhaarNumber,
        vendorType,
        bankDetails,
      } = validationResult.data;

      // Check if user already has a vendor profile
      const existingVendor = await prisma.vendor.findUnique({
        where: { userId: req.user.userId },
      });

      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: "User already has a vendor profile",
        });
      }

      // Create vendor profile
      const vendor = await prisma.vendor.create({
        data: {
          userId: req.user.userId,
          businessName,
          ownerName,
          contactNumbers,
          email: email || null,
          businessAddress,
          googleMapsLink: googleMapsLink || null,
          gstNumber: gstNumber || null,
          panNumber: panNumber || null,
          aadhaarNumber: aadhaarNumber || null,
          vendorType,
          status: "PENDING",
          ...(bankDetails && {
            bankDetails: {
              create: bankDetails,
            },
          }),
        },
        include: {
          bankDetails: true,
          user: {
            select: {
              phoneNumber: true,
              role: true,
            },
          },
        },
      });

      // NOTE: User role remains "CUSTOMER" until vendor application is approved by admin
      // Role will be changed to "VENDOR" only when admin approves the vendor application
      // This prevents unauthorized role escalation

      return res.status(201).json({
        success: true,
        message:
          "Vendor registration submitted successfully. Pending admin approval.",
        data: {
          ...vendor,
          note: "Your application is pending approval. You will remain a customer until approved.",
        },
      });
    } catch (error) {
      console.error("Register Vendor Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Get vendor status
   */
  getVendorStatus = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.userId },
        include: {
          bankDetails: true,
        },
      });

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: "Vendor profile not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          status: vendor.status,
          businessName: vendor.businessName,
          vendorType: vendor.vendorType,
          createdAt: vendor.createdAt,
          commissionRate: vendor.commissionRate,
        },
      });
    } catch (error) {
      console.error("Get Vendor Status Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Update vendor profile
   */
  updateVendorProfile = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.userId },
      });

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: "Vendor profile not found",
        });
      }

      const allowedUpdates = [
        "businessName",
        "ownerName",
        "contactNumbers",
        "email",
        "businessAddress",
        "googleMapsLink",
        "gstNumber",
      ];

      const updates: any = {};
      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const updatedVendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: updates,
        include: {
          bankDetails: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Vendor profile updated successfully",
        data: updatedVendor,
      });
    } catch (error) {
      console.error("Update Vendor Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // ================================
  // ADMIN FUNCTIONS
  // ================================

  /**
   * Get all vendors for admin review
   */
  getVendorsForAdmin = async (req: AuthRequest, res: Response) => {
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { status, vendorType, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (status) where.status = status;
      if (vendorType) where.vendorType = vendorType;

      const vendors = await prisma.vendor.findMany({
        where,
        include: {
          user: {
            select: {
              phoneNumber: true,
              createdAt: true,
            },
          },
          bankDetails: true,
        },
        skip: skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.vendor.count({ where });

      return res.status(200).json({
        success: true,
        data: {
          vendors,
          pagination: {
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Get Vendors For Admin Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Approve vendor
   */
  approveVendor = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { vendorId } = req.params;
      const { commissionRate } = req.body;

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          message: "Vendor ID is required",
        });
      }

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          status: "APPROVED",
          ...(commissionRate && { commissionRate: parseFloat(commissionRate) }),
        },
        include: {
          user: true,
        },
      });

      // SECURITY: Only when admin approves, change user role to VENDOR
      await prisma.user.update({
        where: { id: vendor.userId },
        data: { role: "VENDOR" },
      });

      return res.status(200).json({
        success: true,
        message: "Vendor approved successfully. User role updated to VENDOR.",
        data: vendor,
      });
    } catch (error) {
      console.error("Approve Vendor Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Reject vendor
   */
  rejectVendor = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { vendorId } = req.params;

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          message: "Vendor ID is required",
        });
      }

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { status: "REJECTED" },
        include: {
          user: true,
        },
      });

      // SECURITY: When vendor is rejected, revert user role back to CUSTOMER
      await prisma.user.update({
        where: { id: vendor.userId },
        data: { role: "CUSTOMER" },
      });

      return res.status(200).json({
        success: true,
        message:
          "Vendor rejected successfully. User role reverted to CUSTOMER.",
        data: vendor,
      });
    } catch (error) {
      console.error("Reject Vendor Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Suspend vendor
   */
  suspendVendor = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { vendorId } = req.params;

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          message: "Vendor ID is required",
        });
      }

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { status: "SUSPENDED" },
        include: {
          user: true,
        },
      });

      // SECURITY: When vendor is suspended, revert user role back to CUSTOMER
      await prisma.user.update({
        where: { id: vendor.userId },
        data: { role: "CUSTOMER" },
      });

      return res.status(200).json({
        success: true,
        message:
          "Vendor suspended successfully. User role reverted to CUSTOMER.",
        data: vendor,
      });
    } catch (error) {
      console.error("Suspend Vendor Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Assign admin role to a user (Only existing admins can do this)
   */
  assignAdminRole = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { userId } = req.params;
      const validationResult = adminAssignmentSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { fullName, email, permissions } = validationResult.data;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (targetUser.role === "ADMIN") {
        return res.status(400).json({
          success: false,
          message: "User is already an admin",
        });
      }

      // Update user role to ADMIN
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: "ADMIN" },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Create admin profile
      const adminProfile = await this.createAdminProfile(
        userId,
        fullName || "Admin User",
        email || undefined,
        permissions || ["MANAGE_VENDORS", "MANAGE_USERS"]
      );

      return res.status(200).json({
        success: true,
        message: "Admin role assigned successfully",
        data: {
          user: updatedUser,
          adminProfile,
        },
      });
    } catch (error) {
      console.error("Assign Admin Role Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Revoke admin role from a user (Only existing admins can do this)
   */
  revokeAdminRole = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      // Prevent self-demotion
      if (userId === req.user.userId) {
        return res.status(400).json({
          success: false,
          message: "Cannot revoke your own admin role",
        });
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (targetUser.role !== "ADMIN") {
        return res.status(400).json({
          success: false,
          message: "User is not an admin",
        });
      }

      // Delete admin profile
      await prisma.admin.delete({
        where: { userId },
      });

      // Update user role back to CUSTOMER
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: "CUSTOMER" },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Admin role revoked successfully. User role set to CUSTOMER.",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Revoke Admin Role Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Create admin profile when assigning admin role
   */
  private createAdminProfile = async (
    userId: string,
    fullName?: string,
    email?: string,
    permissions: string[] = ["MANAGE_VENDORS", "MANAGE_USERS"]
  ) => {
    return await prisma.admin.create({
      data: {
        userId,
        fullName: fullName || "Admin User",
        email: email || null,
        permissions,
      },
    });
  };

  /**
   * Get all users for admin review
   */
  getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { role, isActive, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === "true";

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          vendorProfile: {
            select: {
              businessName: true,
              status: true,
              vendorType: true,
            },
          },
          adminProfile: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
        skip: skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.user.count({ where });

      return res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Get All Users Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Activate/Deactivate user account
   */
  toggleUserStatus = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const { userId } = req.params;
      const validationResult = toggleStatusSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { isActive } = validationResult.data;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      // Prevent self-deactivation
      if (userId === req.user.userId && !isActive) {
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate your own account",
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: `User ${isActive ? "activated" : "deactivated"} successfully`,
        data: updatedUser,
      });
    } catch (error) {
      console.error("Toggle User Status Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Update admin profile information
   */
  updateAdminProfile = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required.",
        });
      }

      const validationResult = adminProfileUpdateSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { fullName, email, permissions } = validationResult.data;

      // Find admin profile
      const adminProfile = await prisma.admin.findUnique({
        where: { userId: req.user.userId },
      });

      if (!adminProfile) {
        return res.status(404).json({
          success: false,
          message: "Admin profile not found",
        });
      }

      const updates: any = {};
      if (fullName) updates.fullName = fullName;
      if (email !== undefined) updates.email = email;
      if (permissions && Array.isArray(permissions))
        updates.permissions = permissions;

      const updatedAdmin = await prisma.admin.update({
        where: { id: adminProfile.id },
        data: updates,
      });

      return res.status(200).json({
        success: true,
        message: "Admin profile updated successfully",
        data: updatedAdmin,
      });
    } catch (error) {
      console.error("Update Admin Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Check if phone number exists
   */
  checkPhoneExists = async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      const user = await prisma.user.findUnique({
        where: { phoneNumber },
        select: { id: true, role: true },
      });

      return res.status(200).json({
        success: true,
        data: {
          exists: !!user,
          role: user?.role || null,
        },
      });
    } catch (error) {
      console.error("Check Phone Exists Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * Refresh authentication token
   */
  refreshToken = async (req: Request, res: Response) => {
    try {
      // Validate request body using Zod safeParse
      const validationResult = refreshTokenSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { refreshToken } = validationResult.data;

      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_SECRET || "your-secret-key"
        ) as any;

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (!user || !user.isActive) {
          return res.status(401).json({
            success: false,
            message: "Invalid refresh token",
          });
        }

        const newToken = jwt.sign(
          { userId: user.id, role: user.role },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "7d" }
        );

        return res.status(200).json({
          success: true,
          data: { token: newToken },
        });
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }
    } catch (error) {
      console.error("Refresh Token Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export default AuthController;

import express from "express";
import AuthController from "./authController.js";
import {
  otpRateLimit,
  loginRateLimit,
  vendorRegistrationRateLimit,
  generalRateLimit,
} from "../middleware/validation.js";
import {
  authMiddleware,
  optionalAuth,
  authorize,
  authorizeVendor,
  authorizeAdmin,
} from "../middleware/auth.js";

const router = express.Router();
const authController = new AuthController();

// Apply general rate limiting to all routes
router.use(generalRateLimit);

// ================================
// PUBLIC ROUTES (No Authentication)
// ================================

/**
 * @route POST /api/auth/send-otp
 * @desc Send OTP to phone number for registration/login
 * @access Public
 */
router.post("/send-otp", otpRateLimit, authController.sendOTP);

/**
 * @route POST /api/auth/verify-otp
 * @desc Verify OTP and login/register user
 * @access Public
 */
router.post("/verify-otp", loginRateLimit, authController.verifyOTP);

/**
 * @route POST /api/auth/resend-otp
 * @desc Resend OTP to phone number
 * @access Public
 */
router.post("/resend-otp", otpRateLimit, authController.resendOTP);
/**
 * @route GET /api/auth/check-phone/:phoneNumber
 * @desc Check if phone number is already registered
 * @access Public
 */
router.get("/check-phone/:phoneNumber", authController.checkPhoneExists);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh authentication token
 * @access Public (with valid refresh token)
 */
router.post("/refresh-token", authController.refreshToken);

// ================================
// PROTECTED ROUTES (Requires Authentication)
// ================================

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get("/profile", authMiddleware, authController.getProfile);

/**
 * @route PUT /api/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put("/profile", authMiddleware, authController.updateProfile);

/**
 * @route POST /api/auth/logout
 * @desc Logout user (invalidate session)
 * @access Private
 */
router.post("/logout", authMiddleware, authController.logout);

/**
 * @route GET /api/auth/me
 * @desc Get detailed user information with role-specific data
 * @access Private
 */
router.get("/me", authMiddleware, authController.getDetailedProfile);

// ================================
// VENDOR SPECIFIC ROUTES
// ================================

/**
 * @route POST /api/auth/vendor/register
 * @desc Register as vendor (after OTP verification)
 * @access Private (Must be authenticated user)
 */
router.post(
  "/vendor/register",
  authMiddleware,
  vendorRegistrationRateLimit,
  authController.registerVendor
);
/**
 * @route GET /api/auth/vendor/status
 * @desc Get vendor application status
 * @access Private (Vendor only)
 */
router.get(
  "/vendor/status",
  authMiddleware,
  authorize("VENDOR"),
  authController.getVendorStatus
);

/**
 * @route PUT /api/auth/vendor/profile
 * @desc Update vendor profile information
 * @access Private (Vendor only)
 */
router.put(
  "/vendor/profile",
  authMiddleware,
  authorize("VENDOR"),
  authController.updateVendorProfile
);

// ================================
// ADMIN SPECIFIC ROUTES
// ================================

/**
 * @route GET /api/auth/admin/vendors
 * @desc Get all vendors for admin review
 * @access Private (Admin only)
 */
router.get(
  "/admin/vendors",
  authMiddleware,
  authorizeAdmin,
  authController.getVendorsForAdmin
);

/**
 * @route PUT /api/auth/admin/vendor/:vendorId/approve
 * @desc Approve vendor application
 * @access Private (Admin only)
 */
router.put(
  "/admin/vendor/:vendorId/approve",
  authMiddleware,
  authorizeAdmin,
  authController.approveVendor
);

/**
 * @route PUT /api/auth/admin/vendor/:vendorId/reject
 * @desc Reject vendor application
 * @access Private (Admin only)
 */
router.put(
  "/admin/vendor/:vendorId/reject",
  authMiddleware,
  authorizeAdmin,
  authController.rejectVendor
);

/**
 * @route PUT /api/auth/admin/vendor/:vendorId/suspend
 * @desc Suspend vendor
 * @access Private (Admin only)
 */
router.put(
  "/admin/vendor/:vendorId/suspend",
  authMiddleware,
  authorizeAdmin,
  authController.suspendVendor
);

export default router;

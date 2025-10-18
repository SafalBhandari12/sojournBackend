import { z } from "zod";

// ================================
// ZOD VALIDATION SCHEMAS
// ================================

// Phone number schema
export const phoneNumberSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone number must be exactly 10 digits");

// OTP code schema
export const otpCodeSchema = z
  .string()
  .regex(/^\d{4,6}$/, "OTP code must be 4-6 digits");

// Send OTP validation schema
export const sendOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

// Verify OTP validation schema
export const verifyOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
  verificationId: z.string().min(1, "Verification ID is required"),
  code: otpCodeSchema,
});

// Resend OTP validation schema
export const resendOTPSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

// Vendor registration schema
export const vendorRegistrationSchema = z.object({
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters"),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
  contactNumbers: z
    .array(phoneNumberSchema)
    .min(1, "At least one contact number is required"),
  email: z.string().email("Invalid email format"),
  businessAddress: z
    .string()
    .min(10, "Business address must be at least 10 characters"),
  googleMapsLink: z
    .union([
      z.string().url("Invalid Google Maps link"),
      z.literal(""),
      z.undefined(),
    ])
    .optional(),
  gstNumber: z
    .string()
    .min(3, "GST number must be at least 3 characters")
    .max(50, "GST number cannot exceed 50 characters")
    .regex(/^[A-Z0-9]+$/, "GST number can only contain letters and numbers"),
  panNumber: z
    .string()
    .min(3, "PAN number must be at least 3 characters")
    .max(20, "PAN number cannot exceed 20 characters")
    .regex(/^[A-Z0-9]+$/, "PAN number can only contain letters and numbers"),
  aadhaarNumber: z
    .string()
    .min(3, "Aadhaar number must be at least 3 characters")
    .max(20, "Aadhaar number cannot exceed 20 characters")
    .regex(/^[0-9]+$/, "Aadhaar number can only contain numbers"),
  vendorType: z.enum([
    "HOTEL",
    "ADVENTURE",
    "TRANSPORT",
    "LOCAL_MARKET",
    "OTHER",
  ]),
  bankDetails: z.object({
    accountNumber: z
      .string()
      .min(3, "Account number must be at least 3 characters")
      .max(30, "Account number cannot exceed 30 characters")
      .regex(
        /^[A-Z0-9]+$/i,
        "Account number can only contain letters and numbers"
      ),
    ifscCode: z
      .string()
      .min(3, "IFSC code must be at least 3 characters")
      .max(20, "IFSC code cannot exceed 20 characters")
      .regex(/^[A-Z0-9]+$/i, "IFSC code can only contain letters and numbers"),
    bankName: z.string().min(2, "Bank name is required"),
    branchName: z.string().min(2, "Branch name is required"),
    accountHolder: z.string().min(2, "Account holder name is required"),
  }),
});

// Admin assignment schema
export const adminAssignmentSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .optional(),
  email: z.string().email("Invalid email format").optional(),
  permissions: z.array(z.string()).optional(),
});

// User status toggle schema
export const toggleStatusSchema = z.object({
  isActive: z.boolean(),
});

// Admin profile update schema
export const adminProfileUpdateSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .optional(),
  email: z.string().email("Invalid email format").optional(),
  permissions: z.array(z.string()).optional(),
});

// ================================
// VALIDATION HELPER FUNCTIONS
// ================================

/**
 * Helper function to format validation errors
 */
export const formatValidationErrors = (error: z.ZodError) => {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
};

/**
 * Generic validation function
 */
export const validateRequest = <T>(schema: z.ZodSchema<T>, data: any) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: formatValidationErrors(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
interface ValidatedRequest extends Request {
    validatedData?: any;
}
export declare const sendOTPSchema: z.ZodObject<{
    body: z.ZodObject<{
        phoneNumber: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const verifyOTPSchema: z.ZodObject<{
    body: z.ZodObject<{
        phoneNumber: z.ZodString;
        verificationId: z.ZodString;
        code: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const resendOTPSchema: z.ZodObject<{
    body: z.ZodObject<{
        phoneNumber: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const vendorRegistrationSchema: z.ZodObject<{
    body: z.ZodObject<{
        businessName: z.ZodString;
        ownerName: z.ZodString;
        contactNumbers: z.ZodArray<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        businessAddress: z.ZodString;
        googleMapsLink: z.ZodOptional<z.ZodString>;
        gstNumber: z.ZodOptional<z.ZodString>;
        panNumber: z.ZodOptional<z.ZodString>;
        aadhaarNumber: z.ZodOptional<z.ZodString>;
        vendorType: z.ZodEnum<{
            HOTEL: "HOTEL";
            ADVENTURE: "ADVENTURE";
            TRANSPORT: "TRANSPORT";
            LOCAL_MARKET: "LOCAL_MARKET";
            OTHER: "OTHER";
        }>;
        bankDetails: z.ZodOptional<z.ZodObject<{
            accountNumber: z.ZodString;
            ifscCode: z.ZodString;
            bankName: z.ZodString;
            branchName: z.ZodString;
            accountHolder: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const profileUpdateSchema: z.ZodObject<{
    body: z.ZodObject<{
        role: z.ZodOptional<z.ZodEnum<{
            ADMIN: "ADMIN";
            VENDOR: "VENDOR";
            CUSTOMER: "CUSTOMER";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const vendorProfileUpdateSchema: z.ZodObject<{
    body: z.ZodObject<{
        businessName: z.ZodOptional<z.ZodString>;
        ownerName: z.ZodOptional<z.ZodString>;
        contactNumbers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        email: z.ZodOptional<z.ZodString>;
        businessAddress: z.ZodOptional<z.ZodString>;
        googleMapsLink: z.ZodOptional<z.ZodString>;
        gstNumber: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const approveVendorSchema: z.ZodObject<{
    body: z.ZodObject<{
        commissionRate: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    params: z.ZodObject<{
        vendorId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
/**
 * Generic validation middleware using Zod
 */
export declare const validate: (schema: z.ZodSchema) => (req: ValidatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Sanitize string input
 */
export declare const sanitizeString: (str: string) => string;
/**
 * General API rate limiter - 100 requests per 15 minutes
 */
export declare const generalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
/**
 * OTP rate limiter - 5 OTP requests per 15 minutes per IP
 */
export declare const otpRateLimit: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Login rate limiter - 10 login attempts per 15 minutes per IP
 */
export declare const loginRateLimit: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Vendor registration rate limiter - 3 registrations per day per IP
 */
export declare const vendorRegistrationRateLimit: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Validate Indian phone number
 */
export declare const isValidPhoneNumber: (phoneNumber: string) => boolean;
/**
 * Validate email format
 */
export declare const isValidEmail: (email: string) => boolean;
/**
 * Validate GST number
 */
export declare const isValidGST: (gstNumber: string) => boolean;
/**
 * Validate PAN number
 */
export declare const isValidPAN: (panNumber: string) => boolean;
/**
 * Validate Aadhaar number
 */
export declare const isValidAadhaar: (aadhaarNumber: string) => boolean;
/**
 * Error response helper
 */
export declare const sendValidationError: (res: Response, message: string, errors?: any[]) => Response<any, Record<string, any>>;
export {};
//# sourceMappingURL=validation.d.ts.map
import { z } from "zod";
export declare const phoneNumberSchema: z.ZodString;
export declare const otpCodeSchema: z.ZodString;
export declare const sendOTPSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
}, z.core.$strip>;
export declare const verifyOTPSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    verificationId: z.ZodString;
    code: z.ZodString;
}, z.core.$strip>;
export declare const resendOTPSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
}, z.core.$strip>;
export declare const vendorRegistrationSchema: z.ZodObject<{
    businessName: z.ZodString;
    ownerName: z.ZodString;
    contactNumbers: z.ZodArray<z.ZodString>;
    email: z.ZodString;
    businessAddress: z.ZodString;
    googleMapsLink: z.ZodString;
    gstNumber: z.ZodString;
    panNumber: z.ZodString;
    aadhaarNumber: z.ZodString;
    vendorType: z.ZodEnum<{
        HOTEL: "HOTEL";
        ADVENTURE: "ADVENTURE";
        TRANSPORT: "TRANSPORT";
        LOCAL_MARKET: "LOCAL_MARKET";
        OTHER: "OTHER";
    }>;
    bankDetails: z.ZodObject<{
        accountNumber: z.ZodString;
        ifscCode: z.ZodString;
        bankName: z.ZodString;
        branchName: z.ZodString;
        accountHolder: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const adminAssignmentSchema: z.ZodObject<{
    fullName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const toggleStatusSchema: z.ZodObject<{
    isActive: z.ZodBoolean;
}, z.core.$strip>;
export declare const adminProfileUpdateSchema: z.ZodObject<{
    fullName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Helper function to format validation errors
 */
export declare const formatValidationErrors: (error: z.ZodError) => {
    path: string;
    message: string;
}[];
/**
 * Generic validation function
 */
export declare const validateRequest: <T>(schema: z.ZodSchema<T>, data: any) => {
    success: boolean;
    errors: {
        path: string;
        message: string;
    }[];
    data?: never;
} | {
    success: boolean;
    data: T;
    errors?: never;
};
//# sourceMappingURL=validator.d.ts.map
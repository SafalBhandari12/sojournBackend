interface OTPConfig {
    baseUrl: string;
    countryCode: string;
    customerId: string;
    authToken: string;
    flowType: string;
    defaultTimeout: number;
    maxAttempts: number;
}
interface OTPResult {
    success: boolean;
    data?: any;
    error?: string;
}
/**
 * Get active OTP service configuration from database
 */
export declare function getOTPConfig(): Promise<OTPConfig | null>;
/**
 * Send OTP using MessageCentral API
 */
export declare function sendOTPToMessageCentral(phoneNumber: string, config: OTPConfig): Promise<OTPResult>;
/**
 * Validate OTP using MessageCentral API
 */
export declare function validateOTPWithMessageCentral(phoneNumber: string, verificationId: string, code: string, config: OTPConfig): Promise<OTPResult>;
/**
 * Create OTP record in database
 */
export declare function createOTPRecord(userId: string, phoneNumber: string, verificationId: string, timeout: string): Promise<void>;
/**
 * Find or create user by phone number
 */
export declare function findOrCreateUser(phoneNumber: string): Promise<{
    id: string;
    phoneNumber: string;
    role: import("@prisma/client").$Enums.UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
/**
 * Check if there's an active OTP for a phone number
 */
export declare function hasActiveOTP(phoneNumber: string): Promise<boolean>;
/**
 * Mark all previous OTPs as used for a phone number
 */
export declare function markPreviousOTPsAsUsed(phoneNumber: string): Promise<void>;
/**
 * Find OTP record for verification
 */
export declare function findOTPRecord(verificationId: string, phoneNumber: string): Promise<({
    user: {
        id: string;
        phoneNumber: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
} & {
    userId: string;
    id: string;
    phoneNumber: string;
    createdAt: Date;
    verificationId: string;
    maxAttempts: number;
    otpCode: string | null;
    expiresAt: Date;
    isUsed: boolean;
    isVerified: boolean;
    attempts: number;
    verifiedAt: Date | null;
}) | null>;
/**
 * Mark OTP as verified
 */
export declare function markOTPAsVerified(otpId: string): Promise<void>;
/**
 * Increment OTP attempt count
 */
export declare function incrementOTPAttempts(otpId: string): Promise<void>;
export {};
//# sourceMappingURL=otpUtils.d.ts.map
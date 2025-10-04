import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// ================================
// UTILITY FUNCTIONS
// ================================
/**
 * Get active OTP service configuration from database
 */
export async function getOTPConfig() {
    try {
        const config = await prisma.oTPServiceConfig.findFirst({
            where: { isActive: true },
        });
        return config;
    }
    catch (error) {
        console.error("Error fetching OTP config:", error);
        return null;
    }
}
/**
 * Send OTP using MessageCentral API
 */
export async function sendOTPToMessageCentral(phoneNumber, config) {
    try {
        const response = await fetch(`${config.baseUrl}/verification/v3/send?countryCode=${config.countryCode}&customerId=${config.customerId}&flowType=${config.flowType}&mobileNumber=${phoneNumber}`, {
            method: "POST",
            headers: {
                authToken: config.authToken,
            },
        });
        const result = (await response.json());
        if (result.responseCode === 200 && result.data) {
            return {
                success: true,
                data: {
                    verificationId: result.data.verificationId,
                    mobileNumber: result.data.mobileNumber,
                    timeout: result.data.timeout,
                },
            };
        }
        else {
            return {
                success: false,
                error: result.message || "Failed to send OTP",
            };
        }
    }
    catch (error) {
        console.error("Send OTP API Error:", error);
        return {
            success: false,
            error: "Failed to send OTP",
        };
    }
}
/**
 * Validate OTP using MessageCentral API
 */
export async function validateOTPWithMessageCentral(phoneNumber, verificationId, code, config) {
    try {
        const response = await fetch(`${config.baseUrl}/verification/v3/validateOtp?countryCode=${config.countryCode}&mobileNumber=${phoneNumber}&verificationId=${verificationId}&customerId=${config.customerId}&code=${code}`, {
            method: "GET",
            headers: {
                authToken: config.authToken,
            },
        });
        const result = (await response.json());
        if (result.responseCode === 200 &&
            result.data?.verificationStatus === "VERIFICATION_COMPLETED") {
            return {
                success: true,
                data: result.data,
            };
        }
        else {
            return {
                success: false,
                error: "Invalid OTP code",
            };
        }
    }
    catch (error) {
        console.error("Validate OTP API Error:", error);
        return {
            success: false,
            error: "Failed to validate OTP",
        };
    }
}
/**
 * Create OTP record in database
 */
export async function createOTPRecord(userId, phoneNumber, verificationId, timeout) {
    try {
        await prisma.oTP.create({
            data: {
                userId,
                phoneNumber,
                verificationId,
                expiresAt: new Date(Date.now() + parseInt(timeout) * 1000),
            },
        });
    }
    catch (error) {
        console.error("Error creating OTP record:", error);
        throw error;
    }
}
/**
 * Find or create user by phone number
 */
export async function findOrCreateUser(phoneNumber) {
    try {
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
        return user;
    }
    catch (error) {
        console.error("Error finding/creating user:", error);
        throw error;
    }
}
/**
 * Check if there's an active OTP for a phone number
 */
export async function hasActiveOTP(phoneNumber) {
    try {
        const existingOTP = await prisma.oTP.findFirst({
            where: {
                phoneNumber,
                isUsed: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        return !!existingOTP;
    }
    catch (error) {
        console.error("Error checking active OTP:", error);
        return false;
    }
}
/**
 * Mark all previous OTPs as used for a phone number
 */
export async function markPreviousOTPsAsUsed(phoneNumber) {
    try {
        await prisma.oTP.updateMany({
            where: {
                phoneNumber,
                isUsed: false,
            },
            data: { isUsed: true },
        });
    }
    catch (error) {
        console.error("Error marking previous OTPs as used:", error);
        throw error;
    }
}
/**
 * Find OTP record for verification
 */
export async function findOTPRecord(verificationId, phoneNumber) {
    try {
        return await prisma.oTP.findFirst({
            where: {
                verificationId: verificationId.toString(),
                phoneNumber,
                isUsed: false,
            },
            include: { user: true },
        });
    }
    catch (error) {
        console.error("Error finding OTP record:", error);
        throw error;
    }
}
/**
 * Mark OTP as verified
 */
export async function markOTPAsVerified(otpId) {
    try {
        await prisma.oTP.update({
            where: { id: otpId },
            data: {
                isVerified: true,
                isUsed: true,
                verifiedAt: new Date(),
            },
        });
    }
    catch (error) {
        console.error("Error marking OTP as verified:", error);
        throw error;
    }
}
/**
 * Increment OTP attempt count
 */
export async function incrementOTPAttempts(otpId) {
    try {
        await prisma.oTP.update({
            where: { id: otpId },
            data: {
                attempts: { increment: 1 },
            },
        });
    }
    catch (error) {
        console.error("Error incrementing OTP attempts:", error);
        throw error;
    }
}
//# sourceMappingURL=otpUtils.js.map
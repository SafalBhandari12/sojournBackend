import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
declare class AuthController {
    /**
     * Send OTP to phone number using MessageCentral
     */
    static sendOTP(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Verify OTP and login/register user
     */
    static verifyOTP(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Resend OTP to phone number
     */
    static resendOTP(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get current user profile
     */
    static getProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get detailed user profile with role-specific data
     */
    static getDetailedProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Logout user (invalidate session)
     */
    static logout(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Register as vendor
     */
    static registerVendor(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get vendor status
     */
    static getVendorStatus(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Update vendor profile
     */
    static updateVendorProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get all vendors for admin review
     */
    static getVendorsForAdmin(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Approve vendor
     */
    static approveVendor(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Reject vendor
     */
    static rejectVendor(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Suspend vendor
     */
    static suspendVendor(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Assign admin role to a user (Only existing admins can do this)
     */
    static assignAdminRole(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Revoke admin role from a user (Only existing admins can do this)
     */
    static revokeAdminRole(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Create admin profile when assigning admin role
     */
    static createAdminProfile(userId: string, fullName?: string, email?: string, permissions?: string[]): Promise<{
        userId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        fullName: string;
        permissions: string[];
    }>;
    /**
     * Get all users for admin review
     */
    static getAllUsers(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Activate/Deactivate user account
     */
    static toggleUserStatus(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Update admin profile information
     */
    static updateAdminProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Check if phone number exists
     */
    static checkPhoneExists(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Refresh authentication token with proper security measures
     */
    static refreshToken(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export default AuthController;
//# sourceMappingURL=authController.d.ts.map
import type { Request, Response, NextFunction } from "express";
export interface AuthRequest extends Request {
    user?: {
        userId: string;
        phoneNumber: string;
        role: string;
    } | undefined;
    adminPermissions?: string[];
}
/**
 * Authentication middleware - Requires valid ACCESS JWT token
 */
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Optional authentication middleware - Doesn't require token but sets user if present
 */
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Role-based authorization middleware
 */
export declare const authorize: (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Admin authorization middleware - Only admins with specific permissions
 */
export declare const authorizeAdmin: (permission?: string) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Vendor authorization middleware - Only approved vendors
 */
export declare const authorizeVendor: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Customer authorization middleware - Only customers
 */
export declare const authorizeCustomer: (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Self-authorization middleware - User can only access their own data
 */
export declare const authorizeSelf: (userIdParam?: string) => (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Combined authorization middleware - User can access their own data or admin can access any
 */
export declare const authorizeSelfOrAdmin: (userIdParam?: string) => (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map
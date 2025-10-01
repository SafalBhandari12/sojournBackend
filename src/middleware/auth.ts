import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import type { Request, Response, NextFunction } from "express";

const prisma = new PrismaClient();

// Extend Request interface to include user data
interface AuthRequest extends Request {
  user?:
    | {
        userId: string;
        phoneNumber: string;
        role: string;
      }
    | undefined;
  adminPermissions?: string[];
}

/**
 * Authentication middleware - Requires valid ACCESS JWT token
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as any;

      // Ensure this is an access token, not a refresh token
      if (decoded.type !== "access") {
        return res.status(401).json({
          success: false,
          message: "Invalid token type. Access token required.",
        });
      }

      // Get user from database to ensure they still exist and are active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Access denied. Invalid or inactive user.",
        });
      }

      req.user = {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid token.",
      });
    }
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Optional authentication middleware - Doesn't require token but sets user if present
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      req.user = undefined;
      return next();
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as any;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          phoneNumber: true,
          role: true,
          isActive: true,
        },
      });

      if (user && user.isActive) {
        req.user = {
          userId: user.id,
          phoneNumber: user.phoneNumber,
          role: user.role,
        };
      } else {
        req.user = undefined;
      }
    } catch (jwtError) {
      req.user = undefined;
    }

    next();
  } catch (error) {
    console.error("Optional Auth Middleware Error:", error);
    req.user = undefined;
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

/**
 * Vendor authorization middleware - Only approved vendors
 */
export const authorizeVendor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || req.user.role !== "VENDOR") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Vendor role required.",
      });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.userId },
      select: { status: true },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    if (vendor.status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Vendor not approved.",
        vendorStatus: vendor.status,
      });
    }

    next();
  } catch (error) {
    console.error("Authorize Vendor Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Admin authorization middleware
 */
export const authorizeAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("Hello world");
    console.log(req.user);
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }

    const admin = await prisma.admin.findUnique({
      where: { userId: req.user.userId },
      select: { permissions: true },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin profile not found",
      });
    }

    req.adminPermissions = admin.permissions;
    next();
  } catch (error) {
    console.error("Authorize Admin Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.adminPermissions || !req.adminPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${permission} permission required.`,
      });
    }
    next();
  };
};

// Export the AuthRequest interface for use in other files
export type { AuthRequest };

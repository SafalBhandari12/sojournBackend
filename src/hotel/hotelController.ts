import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import Razorpay from "razorpay";
import crypto from "crypto";
import ImageKit from "imagekit";
import { aiQuestion } from "./validator.js";
import { success, type safeParse } from "zod";
import HotelUtils from "./hotelUtils.js";

const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.RAZOR_PAY_KEY_ID!,
  key_secret: process.env.RAZOR_PAY_KEY_SECRET!,
});

const imagekit = new ImageKit({
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY!,
  urlEndpoint: "https://ik.imagekit.io/sojourn",
});

// ================================
// SECURITY UTILITIES - Data Sanitization
// ================================

class SecurityUtils {
  // Mask phone number to show only last 2 digits
  static maskPhoneNumber(
    phoneNumber: string,
    isOwner: boolean = false
  ): string {
    if (isOwner || !phoneNumber) return phoneNumber;
    if (phoneNumber.length <= 2) return phoneNumber;
    return "*".repeat(phoneNumber.length - 2) + phoneNumber.slice(-2);
  }

  // Generate public-facing booking reference
  static generatePublicBookingRef(bookingId: string): string {
    // Create a short, non-enumerable reference
    return `BK${bookingId.slice(-8).toUpperCase()}`;
  }

  // Clean payment data - remove sensitive fields
  static sanitizePaymentData(payment: any, isOwner: boolean = false): any {
    if (!payment) return null;

    // Base payment info for all users
    const sanitized: any = {
      paymentStatus: payment.paymentStatus,
      paymentMethod: payment.paymentMethod,
      totalAmount: payment.totalAmount,
    };

    // Add processed date if payment is successful
    if (payment.paymentStatus === "SUCCESS" && payment.processedAt) {
      sanitized.processedAt = payment.processedAt;
    }

    // Only payment owner gets refund info
    if (isOwner && payment.refundAmount) {
      sanitized.refundAmount = payment.refundAmount;
      sanitized.refundStatus =
        payment.paymentStatus === "REFUNDED" ? "REFUNDED" : null;
    }

    return sanitized;
  }

  // Clean vendor booking list
  static sanitizeVendorBookingList(bookings: any[], vendorId: string): any[] {
    return bookings.map((booking) => ({
      bookingId: booking.id,
      status: booking.status,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numberOfGuests: booking.numberOfGuests,
      totalAmount: booking.totalAmount,
      createdAt: booking.createdAt,
      specialRequests: booking.specialRequests,
      customer: {
        phoneNumber: this.maskPhoneNumber(
          booking.booking?.user?.phoneNumber || "",
          false
        ),
        firstName: booking.booking?.user?.firstName || "N/A",
        lastName: booking.booking?.user?.lastName || "N/A",
        email: booking.booking?.user?.email || null,
        emergencyContact: booking.booking?.user?.emergencyContact || null,
      },
      guests:
        booking.guests?.map((guest: any) => ({
          firstName: guest.firstName,
          lastName: guest.lastName,
          age: guest.age,
          isPrimaryGuest: guest.isPrimaryGuest,
          specialRequests: guest.specialRequests,
          // Hide sensitive ID proof information for vendors
          hasIdProof: !!(guest.idProofType && guest.idProofNumber),
        })) || [],
      room: {
        type: booking.room?.roomType,
        number: booking.room?.roomNumber,
      },
      payment: {
        status: booking.booking?.payment?.paymentStatus || "PENDING",
        method: booking.booking?.payment?.paymentMethod,
      },
    }));
  }

  // Clean customer booking list
  static sanitizeCustomerBookingList(
    bookings: any[],
    customerId: string
  ): any[] {
    return bookings.map((booking) => ({
      bookingId: booking.id,
      status: booking.status,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numberOfGuests: booking.numberOfGuests,
      totalAmount: booking.totalAmount,
      createdAt: booking.createdAt,
      specialRequests: booking.specialRequests,
      guests:
        booking.guests?.map((guest: any) => ({
          firstName: guest.firstName,
          lastName: guest.lastName,
          age: guest.age,
          isPrimaryGuest: guest.isPrimaryGuest,
          specialRequests: guest.specialRequests,
          idProofType: guest.idProofType,
          idProofNumber: guest.idProofNumber,
        })) || [],
      hotel: {
        name: booking.hotelProfile?.hotelName,
        address: booking.hotelProfile?.vendor?.businessAddress,
        contactNumbers: booking.hotelProfile?.vendor?.contactNumbers,
      },
      room: {
        type: booking.room?.roomType,
        number: booking.room?.roomNumber,
        amenities: booking.room?.amenities,
      },
      payment: this.sanitizePaymentData(booking.booking?.payment, true),
    }));
  }

  // Clean booking data based on user role
  static sanitizeBookingData(
    booking: any,
    currentUserId: string,
    isVendor: boolean = false
  ): any {
    if (!booking) return null;

    const isOwner = booking.booking?.userId === currentUserId;
    const isAuthorizedVendor = isVendor && booking.booking?.vendorId;

    // Base booking info
    const sanitized: any = {
      bookingId: booking.id,
      status: booking.status,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numberOfGuests: booking.numberOfGuests,
      totalAmount: booking.totalAmount,
      createdAt: booking.createdAt,
      specialRequests: booking.specialRequests,
    };

    // Guest information
    if (booking.guests) {
      sanitized.guests = booking.guests.map((guest: any) => {
        const guestData = {
          firstName: guest.firstName,
          lastName: guest.lastName,
          age: guest.age,
          isPrimaryGuest: guest.isPrimaryGuest,
          specialRequests: guest.specialRequests,
        };

        // Customer sees full guest details including ID proof
        if (isOwner) {
          return {
            ...guestData,
            idProofType: guest.idProofType,
            idProofNumber: guest.idProofNumber,
          };
        }

        // Vendor sees guest details but not full ID proof numbers
        if (isAuthorizedVendor) {
          return {
            ...guestData,
            hasIdProof: !!(guest.idProofType && guest.idProofNumber),
            idProofType: guest.idProofType, // Show type but not number
          };
        }

        // Others see limited guest info
        return guestData;
      });
    }

    // Hotel and room info (safe to expose)
    if (booking.hotelProfile) {
      sanitized.hotel = {
        name: booking.hotelProfile.hotelName,
        category: booking.hotelProfile.category,
        address: booking.hotelProfile.vendor?.businessAddress,
        contactNumbers: booking.hotelProfile.vendor?.contactNumbers,
      };
    }

    if (booking.room) {
      sanitized.room = {
        type: booking.room.roomType,
        number: booking.room.roomNumber,
        capacity: booking.room.capacity,
        amenities: booking.room.amenities,
      };
    }

    // Customer info (different levels based on access)
    if (booking.booking?.user) {
      if (isOwner) {
        // Owner sees their own full details
        sanitized.customer = {
          phoneNumber: booking.booking.user.phoneNumber,
          firstName: booking.booking.user.firstName,
          lastName: booking.booking.user.lastName,
          email: booking.booking.user.email,
          emergencyContact: booking.booking.user.emergencyContact,
          idProofType: booking.booking.user.idProofType,
          idProofNumber: booking.booking.user.idProofNumber,
        };
      } else if (isAuthorizedVendor) {
        // Vendor sees enhanced customer info with privacy protection
        sanitized.customer = {
          phoneNumber: this.maskPhoneNumber(
            booking.booking.user.phoneNumber,
            false
          ),
          firstName: booking.booking.user.firstName || "N/A",
          lastName: booking.booking.user.lastName || "N/A",
          email: booking.booking.user.email || null,
          emergencyContact: booking.booking.user.emergencyContact || null,
          hasIdProof: !!(
            booking.booking.user.idProofType &&
            booking.booking.user.idProofNumber
          ),
          idProofType: booking.booking.user.idProofType || null,
        };
      }
    }

    // Payment info (sanitized)
    if (booking.booking?.payment) {
      sanitized.payment = this.sanitizePaymentData(
        booking.booking.payment,
        isOwner
      );
    }

    // Vendor info (only for customers)
    if (isOwner && booking.hotelProfile?.vendor) {
      sanitized.vendor = {
        businessName: booking.hotelProfile.vendor.businessName,
        contactNumbers: booking.hotelProfile.vendor.contactNumbers,
      };
    }

    return sanitized;
  }
}

// Simple response utilities
class ResponseUtils {
  static success(res: Response, message: string, data?: any) {
    return res.status(200).json({
      success: true,
      message,
      data,
    });
  }

  static error(res: Response, message: string, statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  static badRequest(res: Response, message: string) {
    return this.error(res, message, 400);
  }

  static unauthorized(res: Response, message: string) {
    return this.error(res, message, 401);
  }

  static notFound(res: Response, message: string) {
    return this.error(res, message, 404);
  }

  static serverError(res: Response, message: string) {
    return this.error(res, message, 500);
  }
}

// Simple auth utilities
class AuthUtils {
  static getUserIdFromToken(req: Request): string {
    // The auth middleware sets req.user.userId (not req.user.id)
    return (req as any).user?.userId || "";
  }
}

// Simple vendor database utilities
class VendorDbUtils {
  static async findVendorByUserId(userId: string) {
    return await prisma.vendor.findUnique({
      where: { userId },
    });
  }
}

// Extend Request interface to include validated data
interface ValidatedRequest extends Request {
  validatedData?: any;
}

export class HotelController {
  // ================================
  // HOTEL PROFILE MANAGEMENT
  // ================================

  static async createHotelProfile(req: ValidatedRequest, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);

      // Debug logging
      console.log("🔍 Debugging validation data:");
      console.log("req.validatedData:", req.validatedData);
      console.log("req.body:", req.body);

      // Use validated data from middleware
      const validatedBody = req.validatedData?.body;
      const {
        hotelName,
        category,
        totalRooms,
        amenities,
        cancellationPolicy,
        checkInTime,
        checkOutTime,
        imageType = "property",
      } = validatedBody || req.body; // Fallback to req.body if validation data not available

      console.log("📊 Final extracted data:");
      console.log("totalRooms:", totalRooms, "type:", typeof totalRooms);
      console.log("amenities:", amenities, "type:", typeof amenities);

      // Verify user is a vendor
      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(
          res,
          "Only vendors can create hotel profiles"
        );
      }

      if (vendor.vendorType !== "HOTEL") {
        return ResponseUtils.badRequest(
          res,
          "Vendor type must be HOTEL to create hotel profile"
        );
      }

      // Check if hotel profile already exists
      const existingProfile = await prisma.hotelProfile.findUnique({
        where: { vendorId: vendor.id },
      });

      if (existingProfile) {
        return ResponseUtils.badRequest(res, "Hotel profile already exists");
      }

      // Create hotel profile first
      const hotelProfile = await prisma.hotelProfile.create({
        data: {
          vendorId: vendor.id,
          hotelName,
          category,
          totalRooms,
          amenities,
          cancellationPolicy,
          checkInTime,
          checkOutTime,
        },
        include: {
          vendor: {
            select: {
              businessName: true,
              ownerName: true,
              email: true,
              businessAddress: true,
            },
          },
        },
      });

      // Handle image uploads from multer files
      const uploadedImages = [];
      const files = req.files as Express.Multer.File[];

      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;

          const description = Array.isArray(req.body.descriptions)
            ? req.body.descriptions[i]
            : req.body.descriptions || `Hotel image ${i + 1}`;
          const isPrimary = Array.isArray(req.body.isPrimary)
            ? req.body.isPrimary[i] === "true"
            : i === 0; // First image is primary by default

          try {
            // Upload to ImageKit
            const result = await imagekit.upload({
              file: file.buffer,
              fileName: file.originalname || `hotel_${Date.now()}_${i}`,
              folder: `/hotels/${vendor.id}`,
              useUniqueFileName: true,
            });

            // Save to database
            const vendorImage = await prisma.vendorImage.create({
              data: {
                vendorId: vendor.id,
                imageUrl: result.url,
                imageType,
                description,
                isPrimary,
              },
            });

            uploadedImages.push({
              ...vendorImage,
              fileId: result.fileId,
              thumbnailUrl: result.thumbnailUrl,
            });
          } catch (uploadError) {
            console.error("Image upload error:", uploadError);
          }
        }
      }

      return ResponseUtils.success(res, "Hotel profile created successfully", {
        ...hotelProfile,
        uploadedImages,
      });
    } catch (error) {
      console.error("Create hotel profile error:", error);
      return ResponseUtils.serverError(res, "Failed to create hotel profile");
    }
  }

  static async updateHotelProfile(req: ValidatedRequest, res: Response) {
    // TODO: Make sure only the correct data can be appended
    try {
      const userId = AuthUtils.getUserIdFromToken(req);

      // Use validated data from middleware
      const validatedBody = req.validatedData?.body;
      const { imageType = "property", ...updateData } =
        validatedBody || req.body;

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(
          res,
          "Only vendors can update hotel profiles"
        );
      }

      const hotelProfile = await prisma.hotelProfile.findUnique({
        where: { vendorId: vendor.id },
      });

      if (!hotelProfile) {
        return ResponseUtils.notFound(res, "Hotel profile not found");
      }

      // Update hotel profile data
      const updatedProfile = await prisma.hotelProfile.update({
        where: { vendorId: vendor.id },
        data: updateData,
        include: {
          vendor: {
            select: {
              businessName: true,
              ownerName: true,
              email: true,
              businessAddress: true,
            },
          },
          rooms: true,
        },
      });

      // Handle image uploads from multer files
      const uploadedImages = [];
      const files = req.files as Express.Multer.File[];

      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;

          const description = Array.isArray(req.body.descriptions)
            ? req.body.descriptions[i]
            : req.body.descriptions || `Hotel image ${i + 1}`;
          const isPrimary = Array.isArray(req.body.isPrimary)
            ? req.body.isPrimary[i] === "true"
            : false;

          try {
            // Upload to ImageKit
            const result = await imagekit.upload({
              file: file.buffer,
              fileName: file.originalname || `hotel_update_${Date.now()}_${i}`,
              folder: `/hotels/${vendor.id}`,
              useUniqueFileName: true,
            });

            // Save to database
            const vendorImage = await prisma.vendorImage.create({
              data: {
                vendorId: vendor.id,
                imageUrl: result.url,
                imageType,
                description,
                isPrimary,
              },
            });

            uploadedImages.push({
              ...vendorImage,
              fileId: result.fileId,
              thumbnailUrl: result.thumbnailUrl,
            });
          } catch (uploadError) {
            console.error("Image upload error:", uploadError);
          }
        }
      }

      return ResponseUtils.success(res, "Hotel profile updated successfully", {
        ...updatedProfile,
        uploadedImages,
      });
    } catch (error) {
      console.error("Update hotel profile error:", error);
      return ResponseUtils.serverError(res, "Failed to update hotel profile");
    }
  }

  static async getVendorHotelProfile(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(
          res,
          "Only vendors can access hotel profiles"
        );
      }

      const hotelProfile = await prisma.hotelProfile.findUnique({
        where: { vendorId: vendor.id },
        include: {
          vendor: {
            select: {
              businessName: true,
              ownerName: true,
              email: true,
              businessAddress: true,
              images: true,
            },
          },
          rooms: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!hotelProfile) {
        return ResponseUtils.notFound(res, "Hotel profile not found");
      }

      return ResponseUtils.success(
        res,
        "Hotel profile retrieved successfully",
        hotelProfile
      );
    } catch (error) {
      console.error("Get hotel profile error:", error);
      return ResponseUtils.serverError(res, "Failed to retrieve hotel profile");
    }
  }

  static async deleteHotelImage(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { imageId } = req.params;

      if (!imageId) {
        return ResponseUtils.badRequest(res, "Image ID is required");
      }

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(
          res,
          "Only vendors can delete images"
        );
      }

      const image = await prisma.vendorImage.findFirst({
        where: {
          id: imageId,
          vendorId: vendor.id,
        },
      });

      if (!image) {
        return ResponseUtils.notFound(res, "Image not found");
      }

      // Delete from ImageKit
      try {
        // Extract file ID from the ImageKit URL
        const urlParts = image.imageUrl.split("/");
        const fileIdWithExt = urlParts[urlParts.length - 1];

        if (fileIdWithExt) {
          const fileId = fileIdWithExt.split(".")[0];
          if (fileId) {
            await imagekit.deleteFile(fileId);
          }
        }
      } catch (error) {
        console.error("ImageKit deletion error:", error);
        // Continue with database deletion even if ImageKit deletion fails
      }

      // Delete from database
      await prisma.vendorImage.delete({
        where: { id: imageId },
      });

      return ResponseUtils.success(res, "Image deleted successfully");
    } catch (error) {
      console.error("Delete image error:", error);
      return ResponseUtils.serverError(res, "Failed to delete image");
    }
  }

  // ================================
  // ROOM MANAGEMENT
  // ================================

  static async addRoom(req: ValidatedRequest, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);

      // Use validated data from middleware
      const validatedBody = req.validatedData?.body;
      const {
        roomType,
        roomNumber,
        capacity,
        basePrice,
        summerPrice,
        winterPrice,
        amenities,
        imageType = "room",
      } = validatedBody || req.body;

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(res, "Only vendors can add rooms");
      }

      const hotelProfile = await prisma.hotelProfile.findUnique({
        where: { vendorId: vendor.id },
      });

      if (!hotelProfile) {
        return ResponseUtils.notFound(
          res,
          "Hotel profile not found. Create hotel profile first."
        );
      }

      // Check for duplicate room number in the same hotel
      if (roomNumber) {
        const existingRoom = await prisma.room.findFirst({
          where: {
            hotelProfileId: hotelProfile.id,
            roomNumber,
          },
        });

        if (existingRoom) {
          return ResponseUtils.badRequest(
            res,
            `Room number ${roomNumber} already exists in this hotel`
          );
        }
      }

      // Handle room creation and image uploads in a transaction with extended timeout
      const result = await prisma.$transaction(
        async (tx) => {
          const room = await tx.room.create({
            data: {
              hotelProfileId: hotelProfile.id,
              roomType,
              roomNumber,
              capacity,
              basePrice,
              summerPrice,
              winterPrice,
              amenities,
            },
          });

          // Handle image uploads from multer files
          const uploadedImages = [];
          const files = req.files as Express.Multer.File[];
          const imageUploadErrors = [];

          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              if (!file) continue;

              const description = Array.isArray(req.body.descriptions)
                ? req.body.descriptions[i]
                : req.body.descriptions ||
                  `Room ${roomNumber || roomType} image ${i + 1}`;
              const isPrimary = Array.isArray(req.body.isPrimary)
                ? req.body.isPrimary[i] === "true"
                : i === 0; // First image is primary by default

              try {
                // Upload to ImageKit
                const uploadResult = await imagekit.upload({
                  file: file.buffer,
                  fileName:
                    file.originalname || `room_${room.id}_${Date.now()}_${i}`,
                  folder: `/hotels/${vendor.id}/rooms`,
                  useUniqueFileName: true,
                });

                // Save to database
                const vendorImage = await tx.vendorImage.create({
                  data: {
                    vendorId: vendor.id,
                    imageUrl: uploadResult.url,
                    imageType,
                    description,
                    isPrimary,
                    roomId: room.id, // Associate with the room
                  },
                });

                uploadedImages.push({
                  ...vendorImage,
                  fileId: uploadResult.fileId,
                  thumbnailUrl: uploadResult.thumbnailUrl,
                });
              } catch (uploadError) {
                console.error("Image upload error:", uploadError);
                imageUploadErrors.push({
                  index: i,
                  fileName: file.originalname,
                  error:
                    uploadError instanceof Error
                      ? uploadError.message
                      : "Unknown upload error",
                });
              }
            }
          }

          return {
            room,
            uploadedImages,
            imageUploadErrors,
          };
        },
        {
          timeout: 30000, // 30 second timeout for image uploads
        }
      );

      // If there were image upload errors, include them in the response
      if (result.imageUploadErrors.length > 0) {
        return ResponseUtils.success(
          res,
          "Room added successfully with some image upload errors",
          {
            ...result.room,
            uploadedImages: result.uploadedImages,
            imageErrors: result.imageUploadErrors,
          }
        );
      }

      return ResponseUtils.success(res, "Room added successfully", {
        ...result.room,
        uploadedImages: result.uploadedImages,
      });
    } catch (error) {
      console.error("Add room error:", error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("ImageKit")) {
          return ResponseUtils.serverError(res, "Image upload service error");
        }
        if (error.message.includes("Prisma")) {
          return ResponseUtils.serverError(
            res,
            "Database error during room creation"
          );
        }
      }

      return ResponseUtils.serverError(res, "Failed to add room");
    }
  }

  static async updateRoom(req: ValidatedRequest, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { roomId } = req.params;

      // Use validated data from middleware
      const validatedBody = req.validatedData?.body;
      const {
        imageType = "room",
        descriptions,
        isPrimary,
        ...updateData
      } = validatedBody || req.body;

      if (!roomId) {
        return ResponseUtils.badRequest(res, "Room ID is required");
      }

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(res, "Only vendors can update rooms");
      }

      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          hotelProfile: {
            vendorId: vendor.id,
          },
        },
      });

      if (!room) {
        return ResponseUtils.notFound(res, "Room not found");
      }

      // Handle room update and image uploads in a transaction with extended timeout
      const result = await prisma.$transaction(
        async (tx) => {
          // Update room data
          const updatedRoom = await tx.room.update({
            where: { id: roomId },
            data: updateData,
          });

          // Handle image uploads from multer files
          const uploadedImages = [];
          const files = req.files as Express.Multer.File[];
          const imageUploadErrors = [];

          if (files && files.length > 0) {
            // Check if any of the new images should be primary
            const hasPrimaryInRequest = Array.isArray(req.body.isPrimary)
              ? req.body.isPrimary.some((p: string) => p === "true")
              : req.body.isPrimary === "true";

            // If setting a new primary image, update existing ones to non-primary
            if (hasPrimaryInRequest) {
              await tx.vendorImage.updateMany({
                where: {
                  roomId: roomId,
                  isPrimary: true,
                },
                data: {
                  isPrimary: false,
                },
              });
            }

            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              if (!file) continue;

              const description = Array.isArray(req.body.descriptions)
                ? req.body.descriptions[i]
                : req.body.descriptions ||
                  `Room ${room.roomNumber || room.roomType} updated image ${
                    i + 1
                  }`;

              const isPrimary = Array.isArray(req.body.isPrimary)
                ? req.body.isPrimary[i] === "true"
                : req.body.isPrimary === "true" && i === 0; // Only first image can be primary if single value

              try {
                // Upload to ImageKit
                const uploadResult = await imagekit.upload({
                  file: file.buffer,
                  fileName:
                    file.originalname ||
                    `room_${roomId}_update_${Date.now()}_${i}`,
                  folder: `/hotels/${vendor.id}/rooms`,
                  useUniqueFileName: true,
                });

                // Save to database
                const vendorImage = await tx.vendorImage.create({
                  data: {
                    vendorId: vendor.id,
                    imageUrl: uploadResult.url,
                    imageType,
                    description,
                    isPrimary,
                    roomId: roomId, // Associate with the room
                  },
                });

                uploadedImages.push({
                  ...vendorImage,
                  fileId: uploadResult.fileId,
                  thumbnailUrl: uploadResult.thumbnailUrl,
                });
              } catch (uploadError) {
                console.error("Image upload error:", uploadError);
                imageUploadErrors.push({
                  index: i,
                  fileName: file.originalname,
                  error:
                    uploadError instanceof Error
                      ? uploadError.message
                      : "Unknown upload error",
                });
              }
            }
          }

          return {
            room: updatedRoom,
            uploadedImages,
            imageUploadErrors,
          };
        },
        {
          timeout: 30000, // 30 second timeout for image uploads
        }
      );

      // If there were image upload errors, include them in the response
      if (result.imageUploadErrors.length > 0) {
        return ResponseUtils.success(
          res,
          "Room updated successfully with some image upload errors",
          {
            ...result.room,
            uploadedImages: result.uploadedImages,
            imageErrors: result.imageUploadErrors,
          }
        );
      }

      return ResponseUtils.success(res, "Room updated successfully", {
        ...result.room,
        uploadedImages: result.uploadedImages,
      });
    } catch (error) {
      console.error("Update room error:", error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("ImageKit")) {
          return ResponseUtils.serverError(res, "Image upload service error");
        }
        if (error.message.includes("Prisma")) {
          return ResponseUtils.serverError(
            res,
            "Database error during room update"
          );
        }
      }

      return ResponseUtils.serverError(res, "Failed to update room");
    }
  }

  static async deleteRoom(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { roomId } = req.params;

      if (!roomId) {
        return ResponseUtils.badRequest(res, "Room ID is required");
      }

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(res, "Only vendors can delete rooms");
      }

      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          hotelProfile: {
            vendorId: vendor.id,
          },
        },
      });

      if (!room) {
        return ResponseUtils.notFound(res, "Room not found");
      }

      // Check for existing bookings
      const existingBookings = await prisma.hotelBooking.findMany({
        where: {
          roomId: roomId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });

      if (existingBookings.length > 0) {
        return ResponseUtils.badRequest(
          res,
          "Cannot delete room with active bookings"
        );
      }

      await prisma.room.delete({
        where: { id: roomId },
      });

      return ResponseUtils.success(res, "Room deleted successfully");
    } catch (error) {
      console.error("Delete room error:", error);
      return ResponseUtils.serverError(res, "Failed to delete room");
    }
  }

  static async getVendorRooms(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { page = 1, limit = 10 } = req.query;

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(res, "Only vendors can access rooms");
      }

      const hotelProfile = await prisma.hotelProfile.findUnique({
        where: { vendorId: vendor.id },
      });

      if (!hotelProfile) {
        return ResponseUtils.notFound(res, "Hotel profile not found");
      }

      const skip = (Number(page) - 1) * Number(limit);

      // Get rooms with pagination and images, but without booking details
      const rooms = await prisma.room.findMany({
        where: {
          hotelProfileId: hotelProfile.id,
        },
        skip,
        take: Number(limit),
        include: {
          images: {
            orderBy: [
              { isPrimary: "desc" }, // Primary images first
              { uploadedAt: "desc" }, // Then by upload date
            ],
          },
          _count: {
            select: {
              bookings: {
                where: {
                  status: { in: ["PENDING", "CONFIRMED"] }, // Count only active bookings
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Get total count for pagination
      const total = await prisma.room.count({
        where: {
          hotelProfileId: hotelProfile.id,
        },
      });

      // Transform the response to include useful booking statistics without exposing details
      const transformedRooms = rooms.map((room) => ({
        ...room,
        activeBookingsCount: room._count.bookings,
        _count: undefined, // Remove the _count field from response
      }));

      return ResponseUtils.success(res, "Rooms retrieved successfully", {
        rooms: transformedRooms,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("Get rooms error:", error);
      return ResponseUtils.serverError(res, "Failed to retrieve rooms");
    }
  }

  static async toggleRoomAvailability(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { roomId } = req.params;

      if (!roomId) {
        return ResponseUtils.badRequest(res, "Room ID is required");
      }

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(
          res,
          "Only vendors can toggle room availability"
        );
      }

      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          hotelProfile: {
            vendorId: vendor.id,
          },
        },
      });

      if (!room) {
        return ResponseUtils.notFound(res, "Room not found");
      }

      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: { isAvailable: !room.isAvailable },
      });

      return ResponseUtils.success(
        res,
        "Room availability updated",
        updatedRoom
      );
    } catch (error) {
      console.error("Toggle room availability error:", error);
      return ResponseUtils.serverError(
        res,
        "Failed to update room availability"
      );
    }
  }

  // ================================
  // PUBLIC HOTEL SEARCH
  // ================================

  static async searchHotels(req: Request, res: Response) {
    try {
      const {
        category,
        location,
        checkIn,
        checkOut,
        guests,
        minPrice,
        maxPrice,
        amenities,
        page = 1,
        limit = 10,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {
        vendor: {
          status: "APPROVED",
        },
      };

      if (category) {
        where.category = category;
      }

      if (location) {
        where.vendor = {
          ...where.vendor,
          businessAddress: {
            contains: location as string,
            mode: "insensitive",
          },
        };
      }

      if (amenities) {
        const amenitiesArray = (amenities as string).split(",");
        where.amenities = {
          hasEvery: amenitiesArray,
        };
      }

      const hotels = await prisma.hotelProfile.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          vendor: {
            select: {
              businessName: true,
              businessAddress: true,
              images: {
                where: { imageType: "property" },
                take: 5,
              },
            },
          },
          rooms: {
            where: {
              isAvailable: true,
              ...(guests && { capacity: { gte: Number(guests) } }),
              ...(minPrice && { basePrice: { gte: Number(minPrice) } }),
              ...(maxPrice && { basePrice: { lte: Number(maxPrice) } }),
            },
            orderBy: { basePrice: "asc" },
          },
        },
      });

      // Filter hotels that have available rooms for the dates (if provided)
      let availableHotels = hotels;

      if (checkIn && checkOut) {
        availableHotels = [];

        for (const hotel of hotels) {
          const availableRooms =
            await HotelController.getAvailableRoomsForDates(
              hotel.id,
              new Date(checkIn as string),
              new Date(checkOut as string)
            );

          if (availableRooms.length > 0) {
            availableHotels.push({
              ...hotel,
              rooms: availableRooms,
            });
          }
        }
      }

      const total = await prisma.hotelProfile.count({ where });

      return ResponseUtils.success(res, "Hotels retrieved successfully", {
        hotels: availableHotels,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("Search hotels error:", error);
      return ResponseUtils.serverError(res, "Failed to search hotels");
    }
  }

  static async getHotelDetails(req: Request, res: Response) {
    try {
      const { hotelId } = req.params;

      if (!hotelId) {
        return ResponseUtils.badRequest(res, "Hotel ID is required");
      }

      const hotel = await prisma.hotelProfile.findUnique({
        where: { id: hotelId },
        include: {
          vendor: {
            select: {
              businessName: true,
              ownerName: true,
              businessAddress: true,
              contactNumbers: true,
              email: true,
              images: true,
            },
          },
          rooms: {
            where: { isAvailable: true },
            orderBy: { basePrice: "asc" },
          },
        },
      });

      if (!hotel) {
        return ResponseUtils.notFound(res, "Hotel not found");
      }

      return ResponseUtils.success(
        res,
        "Hotel details retrieved successfully",
        hotel
      );
    } catch (error) {
      console.error("Get hotel details error:", error);
      return ResponseUtils.serverError(res, "Failed to retrieve hotel details");
    }
  }

  static async checkRoomAvailability(req: Request, res: Response) {
    try {
      const { hotelId } = req.params;
      const { checkIn, checkOut, guests } = req.query;

      if (!hotelId) {
        return ResponseUtils.badRequest(res, "Hotel ID is required");
      }

      if (!checkIn || !checkOut) {
        return ResponseUtils.badRequest(
          res,
          "Check-in and check-out dates are required"
        );
      }

      const availableRooms = await HotelController.getAvailableRoomsForDates(
        hotelId,
        new Date(checkIn as string),
        new Date(checkOut as string),
        guests ? Number(guests) : undefined
      );

      return ResponseUtils.success(
        res,
        "Room availability checked successfully",
        {
          availableRooms,
          checkIn,
          checkOut,
          guests: guests ? Number(guests) : null,
        }
      );
    } catch (error) {
      console.error("Check availability error:", error);
      return ResponseUtils.serverError(
        res,
        "Failed to check room availability"
      );
    }
  }

  // Helper method to get available rooms for specific dates
  private static async getAvailableRoomsForDates(
    hotelId: string,
    checkIn: Date,
    checkOut: Date,
    guests?: number
  ) {
    const rooms = await prisma.room.findMany({
      where: {
        hotelProfileId: hotelId,
        isAvailable: true,
        ...(guests && { capacity: { gte: guests } }),
      },
    });

    const availableRooms = [];

    for (const room of rooms) {
      // Check if room is available for the given dates with improved conflict detection
      // Only count CONFIRMED bookings and PENDING bookings with successful payments or recent activity
      const conflictingBookings = await prisma.hotelBooking.findMany({
        where: {
          roomId: room.id,
          AND: [
            {
              checkInDate: { lt: checkOut }, // Existing booking starts before new booking ends
            },
            {
              checkOutDate: { gt: checkIn }, // Existing booking ends after new booking starts
            },
            {
              OR: [
                { status: "CONFIRMED" }, // Always count confirmed bookings
                {
                  // Only count PENDING bookings that have successful payments
                  status: "PENDING",
                  booking: {
                    payment: {
                      paymentStatus: "SUCCESS",
                    },
                  },
                },
                {
                  // Count PENDING bookings that are very recent (within 30 minutes) to allow payment completion
                  status: "PENDING",
                  createdAt: {
                    gt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
                  },
                },
              ],
            },
          ],
        },
        include: {
          booking: {
            include: {
              payment: true,
            },
          },
        },
      });

      if (conflictingBookings.length === 0) {
        availableRooms.push(room);
      }
    }

    return availableRooms;
  }

  // ================================
  // BOOKING MANAGEMENT
  // ================================

  static async createHotelBooking(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const {
        hotelId,
        roomId,
        checkInDate,
        checkOutDate,
        numberOfGuests,
        // Enhanced user information
        userDetails,
        guestDetails,
        specialRequests,
      } = req.body;

      // Validate required user details
      if (!userDetails || !userDetails.firstName || !userDetails.lastName) {
        return ResponseUtils.badRequest(
          res,
          "User first name and last name are required"
        );
      }

      // Validate guest details
      if (
        !guestDetails ||
        !Array.isArray(guestDetails) ||
        guestDetails.length === 0
      ) {
        return ResponseUtils.badRequest(
          res,
          "At least one guest detail is required"
        );
      }

      if (guestDetails.length > numberOfGuests) {
        return ResponseUtils.badRequest(
          res,
          "Number of guest details cannot exceed number of guests"
        );
      }

      // Validate primary guest exists
      const primaryGuest = guestDetails.find((guest) => guest.isPrimaryGuest);
      if (!primaryGuest) {
        return ResponseUtils.badRequest(
          res,
          "One guest must be marked as primary guest"
        );
      }

      // Clean up abandoned bookings before creating new booking
      await HotelController.autoCleanupExpiredDraftBookings();

      // Use a transaction to ensure data consistency and prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
        // First, update user information
        const updateData: any = {};
        if (userDetails.firstName) updateData.firstName = userDetails.firstName;
        if (userDetails.lastName) updateData.lastName = userDetails.lastName;
        if (userDetails.email) updateData.email = userDetails.email;
        if (userDetails.dateOfBirth)
          updateData.dateOfBirth = new Date(userDetails.dateOfBirth);
        if (userDetails.address) updateData.address = userDetails.address;
        if (userDetails.emergencyContact)
          updateData.emergencyContact = userDetails.emergencyContact;
        if (userDetails.idProofType)
          updateData.idProofType = userDetails.idProofType;
        if (userDetails.idProofNumber)
          updateData.idProofNumber = userDetails.idProofNumber;

        await tx.user.update({
          where: { id: userId },
          data: updateData,
        });

        // Verify room availability with locking
        const room = await tx.room.findUnique({
          where: { id: roomId },
          include: {
            hotelProfile: {
              include: {
                vendor: true,
              },
            },
          },
        });

        if (!room || !room.isAvailable) {
          throw new Error("Room not found or not available");
        }

        if (room.hotelProfileId !== hotelId) {
          throw new Error("Room does not belong to this hotel");
        }

        if (room.capacity < numberOfGuests) {
          throw new Error("Room capacity exceeded");
        }

        // Check date availability
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);

        if (checkIn >= checkOut) {
          throw new Error("Check-out date must be after check-in date");
        }

        // Verify dates are in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today for comparison
        if (checkIn < today) {
          throw new Error("Check-in date cannot be in the past");
        }

        // Check for conflicting bookings with more robust query
        const conflictingBookings = await tx.hotelBooking.findMany({
          where: {
            roomId,
            AND: [
              {
                checkInDate: { lt: checkOut },
              },
              {
                checkOutDate: { gt: checkIn },
              },
              {
                OR: [
                  { status: "CONFIRMED" },
                  {
                    status: "PENDING",
                    booking: {
                      payment: {
                        paymentStatus: "SUCCESS",
                      },
                    },
                  },
                  {
                    status: "PENDING",
                    createdAt: {
                      gt: new Date(Date.now() - 30 * 60 * 1000),
                    },
                  },
                ],
              },
            ],
          },
          include: {
            booking: {
              include: {
                payment: true,
              },
            },
          },
        });

        if (conflictingBookings.length > 0) {
          throw new Error(
            "Room is not available for selected dates. Another booking already exists for this period."
          );
        }

        // Calculate total amount
        const nights = Math.ceil(
          (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
        );
        const currentMonth = checkIn.getMonth();

        // Determine price based on season
        let pricePerNight = room.basePrice;
        if (currentMonth >= 5 && currentMonth <= 7 && room.summerPrice) {
          pricePerNight = room.summerPrice;
        } else if (
          (currentMonth >= 11 || currentMonth <= 1) &&
          room.winterPrice
        ) {
          pricePerNight = room.winterPrice;
        }

        const totalAmount = pricePerNight * nights;
        const commissionRate = room.hotelProfile.vendor.commissionRate || 16;
        const commissionAmount = (totalAmount * commissionRate) / 100;

        // Create booking within transaction
        const booking = await tx.booking.create({
          data: {
            userId,
            vendorId: room.hotelProfile.vendor.id,
            bookingType: "HOTEL",
            totalAmount,
            commissionAmount,
            status: "DRAFT",
          },
        });

        // Create hotel booking with enhanced information
        const hotelBooking = await tx.hotelBooking.create({
          data: {
            bookingId: booking.id,
            hotelProfileId: hotelId,
            roomId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            numberOfGuests,
            totalAmount,
            status: "DRAFT",
            specialRequests,
          },
        });

        // Create guest records
        const createdGuests = [];
        for (const guest of guestDetails) {
          const createdGuest = await tx.guest.create({
            data: {
              hotelBookingId: hotelBooking.id,
              firstName: guest.firstName,
              lastName: guest.lastName,
              age: guest.age,
              idProofType: guest.idProofType,
              idProofNumber: guest.idProofNumber,
              isPrimaryGuest: guest.isPrimaryGuest || false,
              specialRequests: guest.specialRequests,
            },
          });
          createdGuests.push(createdGuest);
        }

        // Return the complete booking with all related data
        const completeBooking = await tx.hotelBooking.findUnique({
          where: { id: hotelBooking.id },
          include: {
            booking: true,
            hotelProfile: {
              include: {
                vendor: {
                  select: {
                    businessName: true,
                    businessAddress: true,
                    contactNumbers: true,
                  },
                },
              },
            },
            room: true,
            guests: true,
          },
        });

        return completeBooking;
      });

      return ResponseUtils.success(
        res,
        "Booking created successfully with detailed information",
        result
      );
    } catch (error) {
      console.error("Create booking error:", error);

      // Handle specific transaction errors
      if (error instanceof Error) {
        if (error.message.includes("Room is not available")) {
          return ResponseUtils.badRequest(res, error.message);
        }
        if (
          error.message.includes("not found") ||
          error.message.includes("capacity") ||
          error.message.includes("date") ||
          error.message.includes("required")
        ) {
          return ResponseUtils.badRequest(res, error.message);
        }
      }

      return ResponseUtils.serverError(res, "Failed to create booking");
    }
  }

  static async getCustomerBookings(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { status, page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {
        booking: {
          userId,
          bookingType: "HOTEL",
        },
        status: { not: "DRAFT" }, // Exclude DRAFT bookings from customer view
      };

      if (status) {
        where.status = status;
      }

      const bookings = await prisma.hotelBooking.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          booking: {
            include: {
              payment: {
                select: {
                  paymentStatus: true,
                  paymentMethod: true,
                  totalAmount: true,
                  processedAt: true,
                  refundAmount: true,
                },
              },
              user: {
                select: {
                  phoneNumber: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  emergencyContact: true,
                  idProofType: true,
                  idProofNumber: true,
                },
              },
            },
          },
          hotelProfile: {
            include: {
              vendor: {
                select: {
                  businessName: true,
                  businessAddress: true,
                  contactNumbers: true,
                },
              },
            },
          },
          room: {
            select: {
              roomType: true,
              roomNumber: true,
              capacity: true,
              amenities: true,
            },
          },
          guests: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.hotelBooking.count({ where });

      // Sanitize the booking data for customer view
      const sanitizedBookings = SecurityUtils.sanitizeCustomerBookingList(
        bookings,
        userId
      );

      return ResponseUtils.success(res, "Bookings retrieved successfully", {
        bookings: sanitizedBookings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("Get customer bookings error:", error);
      return ResponseUtils.serverError(res, "Failed to retrieve bookings");
    }
  }

  static async getVendorBookings(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { status, page = 1, limit = 10, search } = req.query;

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(
          res,
          "Only vendors can access vendor bookings"
        );
      }

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {
        hotelProfile: {
          vendorId: vendor.id,
        },
      };

      // Base status filter
      const statusFilter = {
        OR: [
          { status: "CONFIRMED" }, // Always show confirmed bookings (payment completed)
          { status: "CANCELLED" }, // Always show cancelled bookings
          { status: "COMPLETED" }, // Always show completed bookings
          {
            // Only show PENDING bookings from the last 10 minutes (active payment attempts)
            status: "PENDING",
            createdAt: {
              gt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
            },
          },
        ],
      };

      if (status) {
        where.status = status;
      } else {
        // Apply default status filter only if no specific status is requested
        where.OR = statusFilter.OR;
      }

      // Add search functionality
      if (search) {
        const searchTerm = search as string;
        // Combine status filter with search conditions
        where.AND = [
          statusFilter,
          {
            OR: [
              { id: { contains: searchTerm, mode: "insensitive" } },
              {
                booking: {
                  user: {
                    phoneNumber: { contains: searchTerm, mode: "insensitive" },
                  },
                },
              },
              {
                room: {
                  roomNumber: { contains: searchTerm, mode: "insensitive" },
                },
              },
            ],
          },
        ];
        // Remove the OR from the top level since we're using AND
        delete where.OR;
      }

      const bookings = await prisma.hotelBooking.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          booking: {
            include: {
              user: {
                select: {
                  phoneNumber: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  emergencyContact: true,
                  idProofType: true,
                  idProofNumber: true,
                },
              },
              payment: {
                select: {
                  paymentStatus: true,
                  paymentMethod: true,
                  totalAmount: true,
                  processedAt: true,
                  refundAmount: true,
                },
              },
            },
          },
          hotelProfile: {
            select: {
              hotelName: true,
              category: true,
            },
          },
          room: {
            select: {
              roomType: true,
              roomNumber: true,
              capacity: true,
            },
          },
          guests: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.hotelBooking.count({ where });

      // Sanitize the booking data for vendor view
      const sanitizedBookings = SecurityUtils.sanitizeVendorBookingList(
        bookings,
        vendor.id
      );

      return ResponseUtils.success(
        res,
        "Vendor bookings retrieved successfully",
        {
          bookings: sanitizedBookings,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        }
      );
    } catch (error) {
      console.error("Get vendor bookings error:", error);
      return ResponseUtils.serverError(
        res,
        "Failed to retrieve vendor bookings"
      );
    }
  }

  static async searchVendorBookingById(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;

      if (!bookingId) {
        return ResponseUtils.badRequest(res, "Booking ID is required");
      }

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(
          res,
          "Only vendors can search bookings"
        );
      }

      // Search by hotel booking ID or main booking ID
      let hotelBooking = await prisma.hotelBooking.findFirst({
        where: {
          AND: [
            {
              OR: [
                { id: bookingId }, // Direct hotel booking ID match
                { booking: { id: bookingId } }, // Main booking ID match
              ],
            },
            {
              hotelProfile: {
                vendorId: vendor.id, // Ensure it belongs to this vendor
              },
            },
            {
              OR: [
                { status: "CONFIRMED" },
                { status: "CANCELLED" },
                { status: "COMPLETED" },
                {
                  status: "PENDING",
                  createdAt: {
                    gt: new Date(Date.now() - 10 * 60 * 1000), // Recent PENDING bookings only
                  },
                },
              ],
            },
          ],
        },
        include: {
          booking: {
            include: {
              user: {
                select: {
                  phoneNumber: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  emergencyContact: true,
                  idProofType: true,
                  idProofNumber: true,
                },
              },
              payment: {
                select: {
                  paymentStatus: true,
                  paymentMethod: true,
                  totalAmount: true,
                  processedAt: true,
                  refundAmount: true,
                },
              },
            },
          },
          hotelProfile: {
            select: {
              hotelName: true,
              category: true,
            },
          },
          room: {
            select: {
              roomType: true,
              roomNumber: true,
              capacity: true,
              amenities: true,
            },
          },
          guests: true,
        },
      });

      if (!hotelBooking) {
        return ResponseUtils.notFound(
          res,
          "Booking not found or access denied"
        );
      }

      // Sanitize the booking data for vendor view
      const sanitizedBooking = SecurityUtils.sanitizeBookingData(
        hotelBooking,
        userId,
        true
      );

      return ResponseUtils.success(
        res,
        "Booking found successfully",
        sanitizedBooking
      );
    } catch (error) {
      console.error("Search vendor booking by ID error:", error);
      return ResponseUtils.serverError(res, "Failed to search booking");
    }
  }

  static async getBookingDetails(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;

      if (!bookingId) {
        return ResponseUtils.badRequest(res, "Booking ID is required");
      }

      // First try to find by hotel booking ID (most common case)
      let hotelBooking = await prisma.hotelBooking.findUnique({
        where: { id: bookingId },
        include: {
          booking: {
            include: {
              user: {
                select: {
                  phoneNumber: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  emergencyContact: true,
                  idProofType: true,
                  idProofNumber: true,
                },
              },
              payment: {
                select: {
                  paymentStatus: true,
                  paymentMethod: true,
                  totalAmount: true,
                  processedAt: true,
                  refundAmount: true,
                },
              },
            },
          },
          hotelProfile: {
            include: {
              vendor: {
                select: {
                  businessName: true,
                  businessAddress: true,
                  contactNumbers: true,
                },
              },
            },
          },
          room: {
            select: {
              roomType: true,
              roomNumber: true,
              capacity: true,
              amenities: true,
            },
          },
          guests: true,
        },
      });

      // If not found, try to find by main booking ID
      if (!hotelBooking) {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            hotelBooking: {
              include: {
                hotelProfile: {
                  include: {
                    vendor: {
                      select: {
                        businessName: true,
                        businessAddress: true,
                        contactNumbers: true,
                      },
                    },
                  },
                },
                room: {
                  select: {
                    roomType: true,
                    roomNumber: true,
                    capacity: true,
                    amenities: true,
                  },
                },
                guests: true,
              },
            },
            user: {
              select: {
                phoneNumber: true,
                firstName: true,
                lastName: true,
                email: true,
                emergencyContact: true,
                idProofType: true,
                idProofNumber: true,
              },
            },
            payment: {
              select: {
                paymentStatus: true,
                paymentMethod: true,
                totalAmount: true,
                processedAt: true,
                refundAmount: true,
              },
            },
          },
        });

        if (booking?.hotelBooking?.[0]) {
          // Transform to match hotelBooking structure
          const firstHotelBooking = booking.hotelBooking[0];
          hotelBooking = {
            ...firstHotelBooking,
            booking: booking as any, // Cast to avoid type issues - will be sanitized anyway
          };
        }
      }

      if (!hotelBooking) {
        return ResponseUtils.notFound(res, "Booking not found");
      }

      // Check if user has access to this booking
      const isCustomer = hotelBooking.booking.userId === userId;
      let isVendor = false;

      if (!isCustomer) {
        // Check if user is the vendor
        const vendor = await VendorDbUtils.findVendorByUserId(userId);
        if (!vendor || hotelBooking.booking.vendorId !== vendor.id) {
          return ResponseUtils.unauthorized(res, "Access denied");
        }
        isVendor = true;
      }

      // Sanitize the booking data based on user role
      const sanitizedBooking = SecurityUtils.sanitizeBookingData(
        hotelBooking,
        userId,
        isVendor
      );

      return ResponseUtils.success(
        res,
        "Booking details retrieved successfully",
        sanitizedBooking
      );
    } catch (error) {
      console.error("Get booking details error:", error);
      return ResponseUtils.serverError(
        res,
        "Failed to retrieve booking details"
      );
    }
  }

  static async cancelBooking(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;

      if (!bookingId) {
        return ResponseUtils.badRequest(res, "Booking ID is required");
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          hotelBooking: true,
          payment: true,
        },
      });

      if (!booking) {
        return ResponseUtils.notFound(res, "Booking not found");
      }

      if (booking.userId !== userId) {
        return ResponseUtils.unauthorized(
          res,
          "Only the booking owner can cancel"
        );
      }

      if (booking.status === "CANCELLED") {
        return ResponseUtils.badRequest(res, "Booking is already cancelled");
      }

      if (booking.status === "COMPLETED") {
        return ResponseUtils.badRequest(
          res,
          "Completed bookings cannot be cancelled"
        );
      }

      // Update booking status
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" },
      });

      // Update hotel booking status
      if (booking.hotelBooking && booking.hotelBooking.length > 0) {
        await prisma.hotelBooking.updateMany({
          where: { bookingId },
          data: { status: "CANCELLED" },
        });
      }

      // Process refund if payment was made
      if (booking.payment && booking.payment.paymentStatus === "SUCCESS") {
        // TODO: Implement refund logic with Razorpay
        console.log("Refund needed for booking:", bookingId);
      }

      return ResponseUtils.success(res, "Booking cancelled successfully");
    } catch (error) {
      console.error("Cancel booking error:", error);
      return ResponseUtils.serverError(res, "Failed to cancel booking");
    }
  }

  static async confirmBooking(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;

      if (!bookingId) {
        return ResponseUtils.badRequest(res, "Booking ID is required");
      }

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(
          res,
          "Only vendors can confirm bookings"
        );
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          hotelBooking: true,
        },
      });

      if (!booking) {
        return ResponseUtils.notFound(res, "Booking not found");
      }

      if (booking.vendorId !== vendor.id) {
        return ResponseUtils.unauthorized(
          res,
          "You can only confirm your own bookings"
        );
      }

      if (booking.status !== "PENDING") {
        return ResponseUtils.badRequest(
          res,
          "Only pending bookings can be confirmed"
        );
      }

      // Update booking status
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "CONFIRMED" },
      });

      // Update hotel booking status
      if (booking.hotelBooking && booking.hotelBooking.length > 0) {
        await prisma.hotelBooking.updateMany({
          where: { bookingId },
          data: { status: "CONFIRMED" },
        });
      }

      return ResponseUtils.success(res, "Booking confirmed successfully");
    } catch (error) {
      console.error("Confirm booking error:", error);
      return ResponseUtils.serverError(res, "Failed to confirm booking");
    }
  }

  // ================================
  // PAYMENT METHODS (Placeholder for Razorpay integration)
  // ================================

  static async createPaymentOrder(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;

      console.log("🔍 CREATE PAYMENT ORDER DEBUG:");
      console.log("- Booking ID:", bookingId);
      console.log("- User ID:", userId);
      console.log(
        "- Razorpay Key ID:",
        process.env.RAZOR_PAY_KEY_ID ? "✅ Present" : "❌ Missing"
      );
      console.log(
        "- Razorpay Secret:",
        process.env.RAZOR_PAY_KEY_SECRET ? "✅ Present" : "❌ Missing"
      );

      if (!bookingId) {
        return ResponseUtils.badRequest(res, "Booking ID is required");
      }

      // Use transaction to ensure booking exists and update status atomically
      const result = await prisma.$transaction(async (tx) => {
        // First, find the hotel booking and get the main booking ID
        const hotelBooking = await tx.hotelBooking.findFirst({
          where: {
            id: bookingId, // bookingId is the hotel booking ID from URL
          },
          include: {
            booking: {
              include: {
                user: {
                  select: {
                    phoneNumber: true,
                  },
                },
                payment: true,
              },
            },
            hotelProfile: {
              select: {
                hotelName: true,
              },
            },
            room: {
              select: {
                roomType: true,
                roomNumber: true,
              },
            },
          },
        });

        if (!hotelBooking) {
          throw new Error("Hotel booking not found");
        }

        // Verify the booking belongs to the current user
        if (hotelBooking.booking.userId !== userId) {
          throw new Error("Booking not found or access denied");
        }

        const booking = hotelBooking.booking;

        // Check if booking is in correct status for payment
        if (!["DRAFT", "PENDING"].includes(booking.status)) {
          throw new Error(
            `Cannot create payment for booking with status: ${booking.status}`
          );
        }

        if (booking.payment && booking.payment.paymentStatus === "SUCCESS") {
          throw new Error("Payment already completed for this booking");
        }

        // Create Razorpay order with comprehensive customer information
        // Generate short receipt (max 40 chars) - use timestamp + last 8 chars of booking ID
        const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
        const shortBookingId = bookingId.slice(-8); // Last 8 chars of booking ID
        const receipt = `bk_${shortBookingId}_${timestamp}`; // Format: bk_12345678_87654321 (max 22 chars)

        const orderOptions = {
          amount: Math.round(booking.totalAmount * 100), // Convert to paise
          currency: "INR",
          receipt, // Shortened receipt under 40 characters
          notes: {
            bookingId,
            userId,
            vendorId: booking.vendorId,
            hotelName: hotelBooking.hotelProfile?.hotelName || "Hotel",
            roomType: hotelBooking.room?.roomType || "Room",
          },
        };

        console.log("🔍 RAZORPAY ORDER OPTIONS:");
        console.log("- Amount (paise):", orderOptions.amount);
        console.log("- Currency:", orderOptions.currency);
        console.log("- Receipt:", orderOptions.receipt);
        console.log("- Notes:", orderOptions.notes);

        const razorpayOrder = await razorpay.orders.create(orderOptions);
        console.log(
          "✅ Razorpay order created successfully:",
          razorpayOrder.id
        );

        // Update booking status to PENDING when payment is initiated
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "PENDING" },
        });

        // Update hotel booking status to PENDING when payment is initiated
        await tx.hotelBooking.update({
          where: { id: bookingId },
          data: { status: "PENDING" },
        });

        // Create or update payment record (use main booking ID)
        const payment = await tx.payment.upsert({
          where: { bookingId: booking.id },
          update: {
            razorpayOrderId: razorpayOrder.id,
            paymentStatus: "PENDING",
          },
          create: {
            bookingId: booking.id,
            vendorId: booking.vendorId,
            totalAmount: booking.totalAmount,
            commissionAmount: booking.commissionAmount,
            vendorAmount: booking.totalAmount - booking.commissionAmount,
            paymentMethod: "RAZORPAY",
            paymentStatus: "PENDING",
            razorpayOrderId: razorpayOrder.id,
          },
        });

        return {
          booking,
          hotelBooking,
          payment,
          razorpayOrder,
        };
      });

      // Prepare response data optimized for web frontend with Razorpay
      const responseData = {
        orderId: result.razorpayOrder.id,
        amount: Math.round(result.booking.totalAmount * 100), // Amount in paise for Razorpay
        currency: "INR",
        key: process.env.RAZOR_PAY_KEY_ID,
        name: "Sojourn", // Company name
        description: `Hotel Booking - ${
          result.hotelBooking.hotelProfile?.hotelName || "Hotel"
        }`,
        image: "https://your-logo-url.com/logo.png", // Add your company logo URL
        prefill: {
          name: "Customer",
          email: "customer@sojourn.com",
          contact: result.booking.user?.phoneNumber || "",
        },
        theme: {
          color: "#F37254", // Your brand color
        },
        modal: {
          ondismiss: () => {
            console.log("Payment modal dismissed");
          },
        },
        retry: {
          enabled: true,
          max_count: 3,
        },
        timeout: 900, // 15 minutes
        remember_customer: false,
        readonly: {
          email: false,
          contact: false,
          name: false,
        },
        hidden: {
          email: false,
          contact: false,
          name: false,
        },
        payment: result.payment,
        booking: {
          id: result.booking.id,
          status: result.booking.status,
          totalAmount: result.booking.totalAmount,
          hotelName: result.hotelBooking.hotelProfile?.hotelName,
          roomType: result.hotelBooking.room?.roomType,
          roomNumber: result.hotelBooking.room?.roomNumber,
        },
      };

      console.log("🔍 PAYMENT ORDER RESPONSE:");
      console.log("- Order ID:", responseData.orderId);
      console.log("- Amount (paise):", responseData.amount);
      console.log("- Currency:", responseData.currency);
      console.log("- Key:", responseData.key ? "✅ Present" : "❌ Missing");
      console.log("- Booking Status Updated to:", result.booking.status);

      return ResponseUtils.success(
        res,
        "Payment order created successfully",
        responseData
      );
    } catch (error) {
      console.error("Create payment order error:", error);

      // Handle specific errors
      if (error instanceof Error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("access denied")
        ) {
          return ResponseUtils.notFound(
            res,
            "Booking not found or access denied"
          );
        }
        if (error.message.includes("Payment already completed")) {
          return ResponseUtils.badRequest(res, error.message);
        }
        if (error.message.includes("Cannot create payment")) {
          return ResponseUtils.badRequest(res, error.message);
        }
      }

      return ResponseUtils.serverError(res, "Failed to create payment order");
    }
  }

  // Remove the insecure UPI payment method - use standard Razorpay checkout instead
  // This method was a security risk as it was creating custom UPI URLs
  // Instead, use createPaymentOrder which creates proper Razorpay orders for all payment methods

  static async verifyPayment(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
        req.body;

      if (!bookingId) {
        return ResponseUtils.badRequest(res, "Booking ID is required");
      }

      // Find the hotel booking first, then get the main booking
      const hotelBooking = await prisma.hotelBooking.findFirst({
        where: { id: bookingId }, // bookingId is the hotel booking ID
        include: {
          booking: {
            include: {
              payment: true,
            },
          },
        },
      });

      if (!hotelBooking) {
        return ResponseUtils.notFound(res, "Hotel booking not found");
      }

      const booking = hotelBooking.booking;

      if (booking.userId !== userId) {
        return ResponseUtils.unauthorized(res, "Access denied");
      }

      if (!booking.payment) {
        return ResponseUtils.notFound(res, "Payment record not found");
      }

      // Verify payment with Razorpay
      const hmac = crypto.createHmac(
        "sha256",
        process.env.RAZOR_PAY_KEY_SECRET!
      );
      hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
      const generated_signature = hmac.digest("hex");

      const isValidSignature = generated_signature === razorpay_signature;

      if (isValidSignature) {
        // Update payment status (use main booking ID)
        await prisma.payment.update({
          where: { bookingId: booking.id },
          data: {
            paymentStatus: "SUCCESS",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            processedAt: new Date(),
          },
        });

        // Update booking status (use main booking ID)
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED" },
        });

        // Update hotel booking status (use hotel booking ID)
        await prisma.hotelBooking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED" },
        });

        return ResponseUtils.success(res, "Payment verified successfully");
      } else {
        await prisma.payment.update({
          where: { bookingId: booking.id },
          data: {
            paymentStatus: "FAILED",
          },
        });

        return ResponseUtils.badRequest(res, "Payment verification failed");
      }
    } catch (error) {
      console.error("Verify payment error:", error);
      return ResponseUtils.serverError(res, "Failed to verify payment");
    }
  }

  static async processRefund(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;
      const { refundAmount } = req.body;

      if (!bookingId) {
        return ResponseUtils.badRequest(res, "Booking ID is required");
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          payment: true,
        },
      });

      if (!booking) {
        return ResponseUtils.notFound(res, "Booking not found");
      }

      if (booking.userId !== userId) {
        return ResponseUtils.unauthorized(res, "Access denied");
      }

      if (!booking.payment || booking.payment.paymentStatus !== "SUCCESS") {
        return ResponseUtils.badRequest(
          res,
          "No successful payment found for this booking"
        );
      }

      if (!booking.payment.razorpayPaymentId) {
        return ResponseUtils.badRequest(res, "No Razorpay payment ID found");
      }

      const refundAmountToProcess = refundAmount || booking.payment.totalAmount;

      try {
        // Process refund with Razorpay
        const refund = await razorpay.payments.refund(
          booking.payment.razorpayPaymentId,
          {
            amount: Math.round(refundAmountToProcess * 100), // Convert to paise
            notes: {
              bookingId,
              reason: "Booking cancellation",
            },
          }
        );

        // Update payment record
        await prisma.payment.update({
          where: { bookingId },
          data: {
            paymentStatus: "REFUNDED",
            refundId: refund.id,
            refundAmount: refundAmountToProcess,
          },
        });

        return ResponseUtils.success(res, "Refund processed successfully", {
          refundId: refund.id,
          refundAmount: refundAmountToProcess,
          status: refund.status,
        });
      } catch (razorpayError) {
        console.error("Razorpay refund error:", razorpayError);
        return ResponseUtils.serverError(
          res,
          "Failed to process refund with payment gateway"
        );
      }
    } catch (error) {
      console.error("Process refund error:", error);
      return ResponseUtils.serverError(res, "Failed to process refund");
    }
  }

  // ================================
  // DRAFT BOOKING CLEANUP
  // ================================

  static async cleanupAbandonedBookings(req: Request, res: Response) {
    try {
      // Only allow admins to run this cleanup
      const userId = AuthUtils.getUserIdFromToken(req);
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.role !== "ADMIN") {
        return ResponseUtils.unauthorized(res, "Only admins can run cleanup");
      }

      // Clean up both DRAFT bookings older than 24 hours and PENDING bookings older than 30 minutes without successful payment
      const draftCutoffTime = new Date();
      draftCutoffTime.setHours(draftCutoffTime.getHours() - 24);

      const pendingCutoffTime = new Date();
      pendingCutoffTime.setMinutes(pendingCutoffTime.getMinutes() - 30);

      const deletedBookings = await prisma.$transaction(async (tx) => {
        // Find expired DRAFT bookings (older than 24 hours)
        const expiredDraftBookings = await tx.booking.findMany({
          where: {
            status: "DRAFT",
            createdAt: { lt: draftCutoffTime },
            bookingType: "HOTEL",
          },
          include: {
            hotelBooking: true,
            payment: true,
          },
        });

        // Find abandoned PENDING bookings (older than 30 minutes without successful payment)
        const abandonedPendingBookings = await tx.booking.findMany({
          where: {
            status: "PENDING",
            createdAt: { lt: pendingCutoffTime },
            bookingType: "HOTEL",
            OR: [
              { payment: null }, // No payment record
              { payment: { paymentStatus: { not: "SUCCESS" } } }, // Failed or pending payment
            ],
          },
          include: {
            hotelBooking: true,
            payment: true,
          },
        });

        const allExpiredBookings = [
          ...expiredDraftBookings,
          ...abandonedPendingBookings,
        ];

        // Delete related records
        for (const booking of allExpiredBookings) {
          // Delete hotel bookings
          await tx.hotelBooking.deleteMany({
            where: { bookingId: booking.id },
          });

          // Delete payment records (if any)
          if (booking.payment) {
            await tx.payment.delete({
              where: { bookingId: booking.id },
            });
          }

          // Delete main booking
          await tx.booking.delete({
            where: { id: booking.id },
          });
        }

        return {
          total: allExpiredBookings.length,
          draft: expiredDraftBookings.length,
          pending: abandonedPendingBookings.length,
          bookings: allExpiredBookings,
        };
      });

      return ResponseUtils.success(res, "Abandoned bookings cleaned up", {
        deletedCount: deletedBookings.total,
        draftBookingsDeleted: deletedBookings.draft,
        pendingBookingsDeleted: deletedBookings.pending,
        deletedBookings: deletedBookings.bookings.map((b) => ({
          id: b.id,
          status: b.status,
          createdAt: b.createdAt,
          totalAmount: b.totalAmount,
        })),
      });
    } catch (error) {
      console.error("Cleanup abandoned bookings error:", error);
      return ResponseUtils.serverError(
        res,
        "Failed to cleanup abandoned bookings"
      );
    }
  }

  static async cleanupExpiredDraftBookings(req: Request, res: Response) {
    try {
      // Only allow admins to run this cleanup
      const userId = AuthUtils.getUserIdFromToken(req);
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.role !== "ADMIN") {
        return ResponseUtils.unauthorized(res, "Only admins can run cleanup");
      }

      // Delete DRAFT bookings older than 24 hours
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 24);

      const deletedBookings = await prisma.$transaction(async (tx) => {
        // Find expired DRAFT bookings
        const expiredBookings = await tx.booking.findMany({
          where: {
            status: "DRAFT",
            createdAt: { lt: cutoffTime },
            bookingType: "HOTEL",
          },
          include: {
            hotelBooking: true,
            payment: true,
          },
        });

        // Delete related records
        for (const booking of expiredBookings) {
          // Delete hotel bookings
          await tx.hotelBooking.deleteMany({
            where: { bookingId: booking.id },
          });

          // Delete payment records (if any)
          if (booking.payment) {
            await tx.payment.delete({
              where: { bookingId: booking.id },
            });
          }

          // Delete main booking
          await tx.booking.delete({
            where: { id: booking.id },
          });
        }

        return expiredBookings;
      });

      return ResponseUtils.success(res, "Expired DRAFT bookings cleaned up", {
        deletedCount: deletedBookings.length,
        deletedBookings: deletedBookings.map((b) => ({
          id: b.id,
          createdAt: b.createdAt,
          totalAmount: b.totalAmount,
        })),
      });
    } catch (error) {
      console.error("Cleanup expired DRAFT bookings error:", error);
      return ResponseUtils.serverError(
        res,
        "Failed to cleanup expired DRAFT bookings"
      );
    }
  }

  // Utility method to automatically clean up expired DRAFT and abandoned PENDING bookings (can be called by cron job)
  static async autoCleanupExpiredDraftBookings() {
    try {
      const draftCutoffTime = new Date();
      draftCutoffTime.setHours(draftCutoffTime.getHours() - 24);

      const pendingCutoffTime = new Date();
      pendingCutoffTime.setMinutes(pendingCutoffTime.getMinutes() - 30);

      const result = await prisma.$transaction(async (tx) => {
        // Find expired DRAFT bookings (older than 24 hours)
        const expiredDraftBookings = await tx.booking.findMany({
          where: {
            status: "DRAFT",
            createdAt: { lt: draftCutoffTime },
            bookingType: "HOTEL",
          },
        });

        // Find abandoned PENDING bookings (older than 30 minutes without successful payment)
        const abandonedPendingBookings = await tx.booking.findMany({
          where: {
            status: "PENDING",
            createdAt: { lt: pendingCutoffTime },
            bookingType: "HOTEL",
            OR: [
              { payment: null }, // No payment record
              { payment: { paymentStatus: { not: "SUCCESS" } } }, // Failed or pending payment
            ],
          },
        });

        const allExpiredBookings = [
          ...expiredDraftBookings,
          ...abandonedPendingBookings,
        ];

        for (const booking of allExpiredBookings) {
          await tx.hotelBooking.deleteMany({
            where: { bookingId: booking.id },
          });

          await tx.payment.deleteMany({
            where: { bookingId: booking.id },
          });

          await tx.booking.delete({
            where: { id: booking.id },
          });
        }

        return {
          total: allExpiredBookings.length,
          draft: expiredDraftBookings.length,
          pending: abandonedPendingBookings.length,
        };
      });

      console.log(
        `Auto-cleanup: Removed ${result.total} expired bookings (${result.draft} DRAFT, ${result.pending} abandoned PENDING)`
      );
      return result;
    } catch (error) {
      console.error("Auto cleanup error:", error);
      return { total: 0, draft: 0, pending: 0 };
    }
  }
  static async AI(req: Request, res: Response) {
    try {
      const result = aiQuestion.safeParse(req.body);
      if (!result.success) {
        return res.json(result.error);
      }
      const answer = await HotelUtils.getResponse(result.data.question);
      return res.json({ success: true, data: answer });
    } catch (error) {
      console.error(error);
    }
  }
}

export const hotelController = HotelController;

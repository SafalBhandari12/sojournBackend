import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import Razorpay from "razorpay";
import crypto from "crypto";
import ImageKit from "imagekit";

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

      const room = await prisma.room.create({
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
            const result = await imagekit.upload({
              file: file.buffer,
              fileName:
                file.originalname || `room_${room.id}_${Date.now()}_${i}`,
              folder: `/hotels/${vendor.id}/rooms`,
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
                roomId: room.id, // Associate with the room
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

      return ResponseUtils.success(res, "Room added successfully", {
        ...room,
        uploadedImages,
      });
    } catch (error) {
      console.error("Add room error:", error);
      return ResponseUtils.serverError(res, "Failed to add room");
    }
  }

  static async updateRoom(req: ValidatedRequest, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { roomId } = req.params;

      // Use validated data from middleware
      const validatedBody = req.validatedData?.body;
      const { imageType = "room", ...updateData } = validatedBody || req.body;

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

      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: updateData,
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
            : req.body.descriptions ||
              `Room ${room.roomNumber || room.roomType} updated image ${i + 1}`;
          const isPrimary = Array.isArray(req.body.isPrimary)
            ? req.body.isPrimary[i] === "true"
            : false;

          try {
            // Upload to ImageKit
            const result = await imagekit.upload({
              file: file.buffer,
              fileName:
                file.originalname || `room_${roomId}_update_${Date.now()}_${i}`,
              folder: `/hotels/${vendor.id}/rooms`,
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
                roomId: roomId, // Associate with the room
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

      return ResponseUtils.success(res, "Room updated successfully", {
        ...updatedRoom,
        uploadedImages,
      });
    } catch (error) {
      console.error("Update room error:", error);
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

      const vendor = await VendorDbUtils.findVendorByUserId(userId);
      if (!vendor) {
        return ResponseUtils.unauthorized(res, "Only vendors can access rooms");
      }

      const hotelProfile = await prisma.hotelProfile.findUnique({
        where: { vendorId: vendor.id },
        include: {
          rooms: {
            orderBy: { createdAt: "desc" },
            include: {
              bookings: {
                where: {
                  status: { in: ["PENDING", "CONFIRMED"] },
                },
              },
            },
          },
        },
      });

      if (!hotelProfile) {
        return ResponseUtils.notFound(res, "Hotel profile not found");
      }

      return ResponseUtils.success(
        res,
        "Rooms retrieved successfully",
        hotelProfile.rooms
      );
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
      const conflictingBookings = await prisma.hotelBooking.findMany({
        where: {
          roomId: room.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          AND: [
            {
              checkInDate: { lt: checkOut }, // Existing booking starts before new booking ends
            },
            {
              checkOutDate: { gt: checkIn }, // Existing booking ends after new booking starts
            },
          ],
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
      const { hotelId, roomId, checkInDate, checkOutDate, numberOfGuests } =
        req.body;

      // Use a transaction to ensure data consistency and prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
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
        if (checkIn < new Date()) {
          throw new Error("Check-in date cannot be in the past");
        }

        // Check for conflicting bookings with more robust query
        const conflictingBookings = await tx.hotelBooking.findMany({
          where: {
            roomId,
            status: { in: ["PENDING", "CONFIRMED"] },
            AND: [
              {
                checkInDate: { lt: checkOut }, // Existing booking starts before new booking ends
              },
              {
                checkOutDate: { gt: checkIn }, // Existing booking ends after new booking starts
              },
            ],
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

        // Determine price based on season (June-Aug = Summer, Dec-Feb = Winter)
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
            status: "PENDING",
          },
        });

        // Create hotel booking within transaction
        const hotelBooking = await tx.hotelBooking.create({
          data: {
            bookingId: booking.id,
            hotelProfileId: hotelId,
            roomId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            numberOfGuests,
            totalAmount,
            status: "PENDING",
          },
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
          },
        });

        return hotelBooking;
      });

      return ResponseUtils.success(res, "Booking created successfully", result);
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
          error.message.includes("date")
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
              payment: true,
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
          room: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.hotelBooking.count({ where });

      return ResponseUtils.success(res, "Bookings retrieved successfully", {
        bookings,
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
      const { status, page = 1, limit = 10 } = req.query;

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
              user: {
                select: {
                  phoneNumber: true,
                },
              },
              payment: true,
            },
          },
          hotelProfile: true,
          room: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.hotelBooking.count({ where });

      return ResponseUtils.success(
        res,
        "Vendor bookings retrieved successfully",
        {
          bookings,
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

  static async getBookingDetails(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;

      if (!bookingId) {
        return ResponseUtils.badRequest(res, "Booking ID is required");
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: {
            select: {
              phoneNumber: true,
            },
          },
          vendor: {
            select: {
              businessName: true,
              contactNumbers: true,
            },
          },
          hotelBooking: {
            include: {
              hotelProfile: true,
              room: true,
            },
          },
          payment: true,
        },
      });

      if (!booking) {
        return ResponseUtils.notFound(res, "Booking not found");
      }

      // Check if user has access to this booking
      if (booking.userId !== userId) {
        // Check if user is the vendor
        const vendor = await VendorDbUtils.findVendorByUserId(userId);
        if (!vendor || booking.vendorId !== vendor.id) {
          return ResponseUtils.unauthorized(res, "Access denied");
        }
      }

      return ResponseUtils.success(
        res,
        "Booking details retrieved successfully",
        booking
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

      if (booking.payment && booking.payment.paymentStatus === "SUCCESS") {
        return ResponseUtils.badRequest(
          res,
          "Payment already completed for this booking"
        );
      }

      // Create Razorpay order
      const orderOptions = {
        amount: Math.round(booking.totalAmount * 100), // Convert to paise
        currency: "INR",
        receipt: `booking_${bookingId}`,
        notes: {
          bookingId,
          userId,
          vendorId: booking.vendorId,
        },
      };

      const razorpayOrder = await razorpay.orders.create(orderOptions);

      // Create or update payment record
      const payment = await prisma.payment.upsert({
        where: { bookingId },
        update: {
          razorpayOrderId: razorpayOrder.id,
          paymentStatus: "PENDING",
        },
        create: {
          bookingId,
          vendorId: booking.vendorId,
          totalAmount: booking.totalAmount,
          commissionAmount: booking.commissionAmount,
          vendorAmount: booking.totalAmount - booking.commissionAmount,
          paymentMethod: "RAZORPAY",
          paymentStatus: "PENDING",
          razorpayOrderId: razorpayOrder.id,
        },
      });

      return ResponseUtils.success(res, "Payment order created successfully", {
        orderId: razorpayOrder.id,
        amount: booking.totalAmount,
        currency: "INR",
        key: process.env.RAZOR_PAY_KEY_ID,
        payment,
      });
    } catch (error) {
      console.error("Create payment order error:", error);
      return ResponseUtils.serverError(res, "Failed to create payment order");
    }
  }

  static async verifyPayment(req: Request, res: Response) {
    try {
      const userId = AuthUtils.getUserIdFromToken(req);
      const { bookingId } = req.params;
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
        req.body;

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
        // Update payment status
        await prisma.payment.update({
          where: { bookingId },
          data: {
            paymentStatus: "SUCCESS",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            processedAt: new Date(),
          },
        });

        // Update booking status
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "CONFIRMED" },
        });

        // Update hotel booking status
        await prisma.hotelBooking.updateMany({
          where: { bookingId },
          data: { status: "CONFIRMED" },
        });

        return ResponseUtils.success(res, "Payment verified successfully");
      } else {
        await prisma.payment.update({
          where: { bookingId },
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
  // UTILITY METHODS
  // ================================

  // Comprehensive room booking validation utility
  private static async validateRoomBooking(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date,
    numberOfGuests: number,
    excludeBookingId?: string
  ): Promise<{ isValid: boolean; error?: string; room?: any }> {
    try {
      // Get room details
      const room = await prisma.room.findUnique({
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
        return { isValid: false, error: "Room not found or not available" };
      }

      if (room.capacity < numberOfGuests) {
        return { isValid: false, error: "Room capacity exceeded" };
      }

      // Check date validity
      if (checkInDate >= checkOutDate) {
        return {
          isValid: false,
          error: "Check-out date must be after check-in date",
        };
      }

      if (checkInDate < new Date()) {
        return { isValid: false, error: "Check-in date cannot be in the past" };
      }

      // Check for conflicting bookings
      const conflictQuery: any = {
        roomId,
        status: { in: ["PENDING", "CONFIRMED"] },
        AND: [
          {
            checkInDate: { lt: checkOutDate }, // Existing booking starts before new booking ends
          },
          {
            checkOutDate: { gt: checkInDate }, // Existing booking ends after new booking starts
          },
        ],
      };

      // Exclude current booking if updating
      if (excludeBookingId) {
        conflictQuery.bookingId = { not: excludeBookingId };
      }

      const conflictingBookings = await prisma.hotelBooking.findMany({
        where: conflictQuery,
      });

      if (conflictingBookings.length > 0) {
        return {
          isValid: false,
          error:
            "Room is not available for selected dates. Another booking already exists for this period.",
        };
      }

      return { isValid: true, room };
    } catch (error) {
      console.error("Room booking validation error:", error);
      return { isValid: false, error: "Failed to validate room booking" };
    }
  }
}

export const hotelController = HotelController;

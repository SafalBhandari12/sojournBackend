import { z } from "zod";

// Hotel Category enum
const hotelCategorySchema = z.enum([
  "RESORT",
  "HOMESTAY",
  "HOUSEBOAT",
  "GUESTHOUSE",
]);

// Room Type enum
const roomTypeSchema = z.enum(["STANDARD", "DELUXE", "SUITE", "DORMITORY"]);

// Time pattern for check-in/check-out times (HH:MM format)
const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Image schema for hotel profile
const imageSchema = z.object({
  file: z.string().min(1, "Image file is required"), // Base64 string or buffer
  fileName: z.string().optional(),
  description: z.string().max(255).optional(),
  isPrimary: z.boolean().default(false),
});

export const createHotelProfileSchema = z.object({
  body: z.object({
    hotelName: z
      .string()
      .min(1, "Hotel name is required")
      .max(255, "Hotel name too long"),
    category: hotelCategorySchema,
    totalRooms: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          const parsed = parseInt(val, 10);
          if (isNaN(parsed)) {
            throw new Error("Total rooms must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine((val) => val >= 1, "Must have at least 1 room"),
    amenities: z.union([z.array(z.string()), z.string()]).transform((val) => {
      if (typeof val === "string") {
        // Try to parse as JSON first (for JSON string arrays)
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            return parsed.filter((item) => typeof item === "string");
          }
        } catch (e) {
          // If JSON parsing fails, treat as comma-separated string
        }
        // Handle comma-separated string or single string
        return val.length > 0 ? val.split(",").map((item) => item.trim()) : [];
      }
      return val || [];
    }),
    cancellationPolicy: z.string().min(1, "Cancellation policy is required"),
    checkInTime: z
      .string()
      .regex(timePattern, "Invalid check-in time format (HH:MM)"),
    checkOutTime: z
      .string()
      .regex(timePattern, "Invalid check-out time format (HH:MM)"),
    imageType: z
      .enum(["property", "room", "amenity", "food"])
      .default("property")
      .optional(),
    descriptions: z.union([z.string(), z.array(z.string())]).optional(),
    isPrimary: z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

export const updateHotelProfileSchema = z.object({
  body: z.object({
    hotelName: z.string().min(1).max(255).optional(),
    category: hotelCategorySchema.optional(),
    totalRooms: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          const parsed = parseInt(val, 10);
          if (isNaN(parsed)) {
            throw new Error("Total rooms must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine((val) => val >= 1, "Must have at least 1 room")
      .optional(),
    amenities: z
      .union([z.array(z.string()), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          // Try to parse as JSON first (for JSON string arrays)
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
              return parsed.filter((item) => typeof item === "string");
            }
          } catch (e) {
            // If JSON parsing fails, treat as comma-separated string
          }
          // Handle comma-separated string or single string
          return val.length > 0
            ? val.split(",").map((item) => item.trim())
            : [];
        }
        return val || [];
      })
      .optional(),
    cancellationPolicy: z.string().min(1).optional(),
    checkInTime: z
      .string()
      .regex(timePattern, "Invalid check-in time format (HH:MM)")
      .optional(),
    checkOutTime: z
      .string()
      .regex(timePattern, "Invalid check-out time format (HH:MM)")
      .optional(),
    imageType: z
      .enum(["property", "room", "amenity", "food"])
      .default("property")
      .optional(),
    descriptions: z.union([z.string(), z.array(z.string())]).optional(),
    isPrimary: z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

export const addRoomSchema = z.object({
  body: z.object({
    roomType: roomTypeSchema,
    roomNumber: z.string().max(50).optional(),
    capacity: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          const parsed = parseInt(val, 10);
          if (isNaN(parsed)) {
            throw new Error("Capacity must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine((val) => val >= 1, "Room must accommodate at least 1 person"),
    basePrice: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          const parsed = parseFloat(val);
          if (isNaN(parsed)) {
            throw new Error("Base price must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine((val) => val >= 0, "Price cannot be negative"),
    summerPrice: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          if (val === "") return undefined;
          const parsed = parseFloat(val);
          if (isNaN(parsed)) {
            throw new Error("Summer price must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine(
        (val) => val === undefined || val >= 0,
        "Price cannot be negative"
      )
      .optional(),
    winterPrice: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          if (val === "") return undefined;
          const parsed = parseFloat(val);
          if (isNaN(parsed)) {
            throw new Error("Winter price must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine(
        (val) => val === undefined || val >= 0,
        "Price cannot be negative"
      )
      .optional(),
    amenities: z.union([z.array(z.string()), z.string()]).transform((val) => {
      if (typeof val === "string") {
        // Try to parse as JSON first (for JSON string arrays)
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            return parsed.filter((item) => typeof item === "string");
          }
        } catch (e) {
          // If JSON parsing fails, treat as comma-separated string
        }
        return val.length > 0 ? val.split(",").map((item) => item.trim()) : [];
      }
      return val || [];
    }),
    imageType: z
      .enum(["property", "room", "amenity", "food"])
      .default("room")
      .optional(),
    descriptions: z.union([z.string(), z.array(z.string())]).optional(),
    isPrimary: z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

export const updateRoomSchema = z.object({
  body: z.object({
    roomType: roomTypeSchema.optional(),
    roomNumber: z.string().max(50).optional(),
    capacity: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          const parsed = parseInt(val, 10);
          if (isNaN(parsed)) {
            throw new Error("Capacity must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine((val) => val >= 1, "Room must accommodate at least 1 person")
      .optional(),
    basePrice: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          const parsed = parseFloat(val);
          if (isNaN(parsed)) {
            throw new Error("Base price must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine((val) => val >= 0, "Price cannot be negative")
      .optional(),
    summerPrice: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          if (val === "") return undefined;
          const parsed = parseFloat(val);
          if (isNaN(parsed)) {
            throw new Error("Summer price must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine(
        (val) => val === undefined || val >= 0,
        "Price cannot be negative"
      )
      .optional(),
    winterPrice: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          if (val === "") return undefined;
          const parsed = parseFloat(val);
          if (isNaN(parsed)) {
            throw new Error("Winter price must be a valid number");
          }
          return parsed;
        }
        return val;
      })
      .refine(
        (val) => val === undefined || val >= 0,
        "Price cannot be negative"
      )
      .optional(),
    amenities: z
      .union([z.array(z.string()), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          // Try to parse as JSON first (for JSON string arrays)
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
              return parsed.filter((item) => typeof item === "string");
            }
          } catch (e) {
            // If JSON parsing fails, treat as comma-separated string
          }
          return val.length > 0
            ? val.split(",").map((item) => item.trim())
            : [];
        }
        return val || [];
      })
      .optional(),
    isAvailable: z.boolean().optional(),
    imageType: z
      .enum(["property", "room", "amenity", "food"])
      .default("room")
      .optional(),
    descriptions: z.union([z.string(), z.array(z.string())]).optional(),
    isPrimary: z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

export const hotelBookingSchema = z.object({
  body: z
    .object({
      hotelId: z.string().min(1, "Hotel ID is required"),
      roomId: z.string().min(1, "Room ID is required"),
      checkInDate: z
        .string()
        .transform((str) => new Date(str))
        .refine((date) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Set to start of today
          return date >= today;
        }, "Check-in date cannot be in the past"),
      checkOutDate: z.string().transform((str) => new Date(str)),
      numberOfGuests: z.number().int().min(1, "Must have at least 1 guest"),
    })
    .refine((data) => data.checkOutDate > data.checkInDate, {
      message: "Check-out date must be after check-in date",
      path: ["checkOutDate"],
    }),
});

export const imageUploadSchema = z.object({
  body: z.object({
    imageType: z
      .enum(["property", "room", "amenity", "food"])
      .default("property")
      .optional(),
    descriptions: z.union([z.string(), z.array(z.string())]).optional(),
    isPrimary: z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

export const searchHotelsSchema = z.object({
  query: z.object({
    category: hotelCategorySchema.optional(),
    location: z.string().optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    guests: z
      .string()
      .transform((val) => (val ? parseInt(val) : undefined))
      .optional(),
    minPrice: z
      .string()
      .transform((val) => (val ? parseFloat(val) : undefined))
      .optional(),
    maxPrice: z
      .string()
      .transform((val) => (val ? parseFloat(val) : undefined))
      .optional(),
    amenities: z.string().optional(), // Comma-separated string
    page: z
      .string()
      .optional()
      .default("1")
      .transform((val) => parseInt(val) || 1),
    limit: z
      .string()
      .optional()
      .default("10")
      .transform((val) => parseInt(val) || 10),
  }),
});

export const checkAvailabilitySchema = z.object({
  query: z.object({
    checkIn: z.string().min(1, "Check-in date is required"),
    checkOut: z.string().min(1, "Check-out date is required"),
    guests: z
      .string()
      .transform((val) => (val ? parseInt(val) : undefined))
      .optional(),
  }),
});

export const paymentVerificationSchema = z.object({
  body: z.object({
    razorpay_payment_id: z.string().min(1, "Payment ID is required"),
    razorpay_order_id: z.string().min(1, "Order ID is required"),
    razorpay_signature: z.string().min(1, "Payment signature is required"),
  }),
});

export const refundSchema = z.object({
  body: z.object({
    refundAmount: z.number().min(0).optional(),
  }),
});

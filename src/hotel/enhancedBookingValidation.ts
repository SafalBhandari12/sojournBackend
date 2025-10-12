import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// ID Proof Types enum
const idProofTypeSchema = z.enum([
  "AADHAR",
  "PASSPORT",
  "DRIVING_LICENSE",
  "VOTER_ID",
  "PAN_CARD",
]);

// Enhanced User Details Schema
const userDetailsSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name cannot exceed 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "First name can only contain letters and spaces"),

  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name cannot exceed 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Last name can only contain letters and spaces"),

  email: z.string().email("Valid email address is required").optional(),

  dateOfBirth: z
    .string()
    .datetime("Invalid date format")
    .transform((val) => new Date(val))
    .refine((date) => {
      const today = new Date();
      const age = today.getFullYear() - date.getFullYear();
      return age >= 18 && age <= 120;
    }, "Age must be between 18 and 120 years")
    .optional(),

  address: z
    .string()
    .max(200, "Address cannot exceed 200 characters")
    .optional(),

  emergencyContact: z
    .string()
    .regex(
      /^\+?[\d\s\-\(\)]+$/,
      "Emergency contact must be a valid phone number"
    )
    .optional(),

  idProofType: idProofTypeSchema.optional(),

  idProofNumber: z
    .string()
    .min(3, "ID proof number must be at least 3 characters")
    .max(20, "ID proof number cannot exceed 20 characters")
    .optional(),
});

// Guest Details Schema
const guestDetailsSchema = z.object({
  firstName: z
    .string()
    .min(2, "Guest first name must be at least 2 characters")
    .max(50, "Guest first name cannot exceed 50 characters")
    .regex(
      /^[a-zA-Z\s]+$/,
      "Guest first name can only contain letters and spaces"
    ),

  lastName: z
    .string()
    .min(2, "Guest last name must be at least 2 characters")
    .max(50, "Guest last name cannot exceed 50 characters")
    .regex(
      /^[a-zA-Z\s]+$/,
      "Guest last name can only contain letters and spaces"
    ),

  age: z
    .number()
    .int("Age must be a whole number")
    .min(1, "Age must be at least 1")
    .max(120, "Age cannot exceed 120")
    .optional(),

  idProofType: idProofTypeSchema.optional(),

  idProofNumber: z
    .string()
    .min(3, "Guest ID proof number must be at least 3 characters")
    .max(20, "Guest ID proof number cannot exceed 20 characters")
    .optional(),

  isPrimaryGuest: z.boolean().default(false),

  specialRequests: z
    .string()
    .max(200, "Guest special requests cannot exceed 200 characters")
    .optional(),
});

// Main Enhanced Booking Schema
export const enhancedBookingCreationSchema = z.object({
  body: z
    .object({
      hotelId: z.string().min(1, "Hotel ID is required"),

      roomId: z.string().min(1, "Room ID is required"),

      checkInDate: z
        .string()
        .datetime("Check-in date must be a valid ISO date"),

      checkOutDate: z
        .string()
        .datetime("Check-out date must be a valid ISO date"),

      numberOfGuests: z
        .number()
        .int("Number of guests must be a whole number")
        .min(1, "At least 1 guest is required")
        .max(10, "Maximum 10 guests allowed"),

      userDetails: userDetailsSchema,

      guestDetails: z
        .array(guestDetailsSchema)
        .min(1, "At least one guest detail is required")
        .refine((guests) => {
          const primaryGuests = guests.filter((guest) => guest.isPrimaryGuest);
          return primaryGuests.length === 1;
        }, "Exactly one guest must be marked as primary guest"),

      specialRequests: z
        .string()
        .max(500, "Special requests cannot exceed 500 characters")
        .optional(),
    })
    .refine(
      (data) => {
        // Validate that check-out is after check-in
        const checkIn = new Date(data.checkInDate);
        const checkOut = new Date(data.checkOutDate);
        return checkOut > checkIn;
      },
      {
        message: "Check-out date must be after check-in date",
        path: ["checkOutDate"],
      }
    )
    .refine(
      (data) => {
        // Validate that check-in is not in the past
        const checkIn = new Date(data.checkInDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return checkIn >= today;
      },
      {
        message: "Check-in date cannot be in the past",
        path: ["checkInDate"],
      }
    )
    .refine(
      (data) => {
        // Validate guest count doesn't exceed numberOfGuests
        return data.guestDetails.length <= data.numberOfGuests;
      },
      {
        message: "Number of guest details cannot exceed number of guests",
        path: ["guestDetails"],
      }
    ),
});

// Validation middleware
export const validateEnhancedBookingCreation = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = enhancedBookingCreationSchema.parse({
      body: req.body,
    });

    // Store validated data for use in controller
    (req as any).validatedData = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal validation error",
    });
  }
};

// Usage example in routes:
// router.post('/bookings', validateEnhancedBookingCreation, HotelController.createHotelBooking);

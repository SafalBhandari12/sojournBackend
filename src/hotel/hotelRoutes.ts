import express from "express";
import { hotelController } from "./hotelController.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { uploadHotelImages, handleMulterError } from "../middleware/upload.js";
import {
  createHotelProfileSchema,
  updateHotelProfileSchema,
  addRoomSchema,
  updateRoomSchema,
  hotelBookingSchema,
  imageUploadSchema,
  searchHotelsSchema,
  checkAvailabilitySchema,
  paymentVerificationSchema,
  refundSchema,
} from "./validator.js";

const router = express.Router();

// ================================
// VENDOR HOTEL MANAGEMENT ROUTES
// ================================

// Create hotel profile (vendor only)
router.post(
  "/profile",
  authMiddleware,
  uploadHotelImages,
  handleMulterError,
  validate(createHotelProfileSchema),
  hotelController.createHotelProfile
);

// Update hotel profile (vendor only)
router.put(
  "/profile",
  authMiddleware,
  uploadHotelImages,
  handleMulterError,
  validate(updateHotelProfileSchema),
  hotelController.updateHotelProfile
);

// Get vendor's hotel profile
router.get("/profile", authMiddleware, hotelController.getVendorHotelProfile);

// Delete hotel image
router.delete(
  "/profile/images/:imageId",
  authMiddleware,
  hotelController.deleteHotelImage
);

// ================================
// ROOM MANAGEMENT ROUTES
// ================================

// Add new room
router.post(
  "/rooms",
  authMiddleware,
  uploadHotelImages,
  handleMulterError,
  validate(addRoomSchema),
  hotelController.addRoom
);

// Update room details
router.put(
  "/rooms/:roomId",
  authMiddleware,
  uploadHotelImages,
  handleMulterError,
  validate(updateRoomSchema),
  hotelController.updateRoom
);

// Delete room
router.delete("/rooms/:roomId", authMiddleware, hotelController.deleteRoom);

// Get vendor's all rooms
router.get("/rooms", authMiddleware, hotelController.getVendorRooms);

// Toggle room availability
router.patch(
  "/rooms/:roomId/availability",
  authMiddleware,
  hotelController.toggleRoomAvailability
);

// ================================
// PUBLIC HOTEL SEARCH ROUTES
// ================================

// Search available hotels
router.get(
  "/search",
  validate(searchHotelsSchema),
  hotelController.searchHotels
);

// Get hotel details by ID
router.get("/:hotelId", hotelController.getHotelDetails);

// Get available rooms for specific dates
router.get(
  "/:hotelId/availability",
  validate(checkAvailabilitySchema),
  hotelController.checkRoomAvailability
);

// ================================
// BOOKING MANAGEMENT ROUTES
// ================================

// Create hotel booking (customer)
router.post(
  "/bookings",
  authMiddleware,
  validate(hotelBookingSchema),
  hotelController.createHotelBooking
);

// Get customer bookings
router.get("/bookings", authMiddleware, hotelController.getCustomerBookings);

// Get vendor bookings
router.get(
  "/vendor/bookings",
  authMiddleware,
  hotelController.getVendorBookings
);

// Get booking details
router.get(
  "/bookings/:bookingId",
  authMiddleware,
  hotelController.getBookingDetails
);

// Cancel booking
router.patch(
  "/bookings/:bookingId/cancel",
  authMiddleware,
  hotelController.cancelBooking
);

// Confirm booking (vendor)
router.patch(
  "/bookings/:bookingId/confirm",
  authMiddleware,
  hotelController.confirmBooking
);

// ================================
// PAYMENT ROUTES
// ================================

// Create Razorpay order
router.post(
  "/bookings/:bookingId/payment/create-order",
  authMiddleware,
  hotelController.createPaymentOrder
);

// Verify payment
router.post(
  "/bookings/:bookingId/payment/verify",
  authMiddleware,
  validate(paymentVerificationSchema),
  hotelController.verifyPayment
);

// Process refund
router.post(
  "/bookings/:bookingId/payment/refund",
  authMiddleware,
  validate(refundSchema),
  hotelController.processRefund
);

export { router as hotelRoutes };

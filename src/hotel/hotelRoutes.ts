import express from "express";
import type { Request, Response } from "express";
import { hotelController } from "./hotelController.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { uploadHotelImages, handleMulterError } from "../middleware/upload.js";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
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

const prisma = new PrismaClient();

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
// PAYMENT CALLBACK ROUTES (for WebView checkout)
// ================================

// Payment success callback
router.get("/payment-success", (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { background: white; border-radius: 10px; padding: 40px; margin: 0 auto; max-width: 400px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .success { color: #28a745; font-size: 48px; margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; margin-bottom: 30px; }
        .close-btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 5px; font-size: 16px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success">✓</div>
        <h1>Payment Successful!</h1>
        <p>Your booking has been confirmed. You can close this window and return to the app.</p>
        <button class="close-btn" onclick="window.close()">Close Window</button>
      </div>
      <script>
        // Auto-close after 5 seconds
        setTimeout(() => { 
          try { window.close(); } catch(e) { console.log('Cannot close window'); }
        }, 5000);
      </script>
    </body>
    </html>
  `);
});

// Payment cancel/failure callback
router.get("/payment-cancel", (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Cancelled</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { background: white; border-radius: 10px; padding: 40px; margin: 0 auto; max-width: 400px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .cancel { color: #dc3545; font-size: 48px; margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; margin-bottom: 30px; }
        .close-btn { background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 5px; font-size: 16px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="cancel">✗</div>
        <h1>Payment Cancelled</h1>
        <p>Your payment was not completed. You can try again later from your bookings page.</p>
        <button class="close-btn" onclick="window.close()">Close Window</button>
      </div>
      <script>
        // Auto-close after 5 seconds
        setTimeout(() => { 
          try { window.close(); } catch(e) { console.log('Cannot close window'); }
        }, 5000);
      </script>
    </body>
    </html>
  `);
});

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

// Razorpay webhook for automatic payment verification
router.post("/payment-webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "")
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = req.body;

    // Handle payment.captured event
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      // Find booking by order ID
      const bookingPayment = await prisma.payment.findFirst({
        where: { razorpayOrderId: orderId },
        include: { booking: true },
      });

      if (bookingPayment) {
        // Update payment status
        await prisma.payment.update({
          where: { id: bookingPayment.id },
          data: {
            paymentStatus: "SUCCESS",
            razorpayPaymentId: payment.id,
            processedAt: new Date(),
          },
        });

        // Update booking status
        await prisma.booking.update({
          where: { id: bookingPayment.bookingId },
          data: { status: "CONFIRMED" },
        });

        // Update hotel booking status
        await prisma.hotelBooking.updateMany({
          where: { bookingId: bookingPayment.bookingId },
          data: { status: "CONFIRMED" },
        });

        console.log(
          `Payment confirmed via webhook for booking: ${bookingPayment.bookingId}`
        );
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// AI Features
router.post("/ai", authMiddleware, hotelController.AI);

// Admin utility routes
router.post(
  "/admin/cleanup-expired-drafts",
  authMiddleware,
  hotelController.cleanupExpiredDraftBookings
);

export { router as hotelRoutes };

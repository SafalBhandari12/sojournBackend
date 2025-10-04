import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class HotelUtils {
  // Calculate room price based on season
  static calculateRoomPrice(
    room: {
      basePrice: number;
      summerPrice?: number | null;
      winterPrice?: number | null;
    },
    checkInDate: Date
  ): number {
    const month = checkInDate.getMonth();

    // Summer season: June to August (months 5-7)
    if (month >= 5 && month <= 7 && room.summerPrice) {
      return room.summerPrice;
    }

    // Winter season: December to February (months 11, 0, 1)
    if ((month >= 11 || month <= 1) && room.winterPrice) {
      return room.winterPrice;
    }

    return room.basePrice;
  }

  // Calculate number of nights between two dates
  static calculateNights(checkIn: Date, checkOut: Date): number {
    const timeDiff = checkOut.getTime() - checkIn.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  // Check if dates overlap
  static datesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  // Validate check-in and check-out dates
  static validateBookingDates(
    checkIn: Date,
    checkOut: Date
  ): {
    isValid: boolean;
    error?: string;
  } {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time to start of day

    if (checkIn < now) {
      return {
        isValid: false,
        error: "Check-in date cannot be in the past",
      };
    }

    if (checkOut <= checkIn) {
      return {
        isValid: false,
        error: "Check-out date must be after check-in date",
      };
    }

    // Check if booking is too far in advance (1 year)
    const maxAdvanceDate = new Date();
    maxAdvanceDate.setFullYear(maxAdvanceDate.getFullYear() + 1);

    if (checkIn > maxAdvanceDate) {
      return {
        isValid: false,
        error: "Booking cannot be made more than 1 year in advance",
      };
    }

    return { isValid: true };
  }

  // Get room availability for specific dates
  static async getRoomAvailability(
    roomId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean> {
    const conflictingBookings = await prisma.hotelBooking.findMany({
      where: {
        roomId,
        status: { in: ["PENDING", "CONFIRMED"] },
        OR: [
          {
            checkInDate: { lt: checkOut },
            checkOutDate: { gt: checkIn },
          },
        ],
      },
    });

    return conflictingBookings.length === 0;
  }

  // Calculate commission amount
  static calculateCommission(
    totalAmount: number,
    commissionRate: number
  ): number {
    return (totalAmount * commissionRate) / 100;
  }

  // Format price for display
  static formatPrice(amount: number, currency = "INR"): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Generate booking reference number
  static generateBookingReference(bookingId: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const shortId = bookingId.slice(-6).toUpperCase();
    return `SJN-${timestamp}-${shortId}`;
  }

  // Check cancellation policy
  static canCancelBooking(
    checkInDate: Date,
    cancellationPolicy: string,
    bookingStatus: string
  ): { canCancel: boolean; reason?: string } {
    if (bookingStatus === "CANCELLED") {
      return { canCancel: false, reason: "Booking is already cancelled" };
    }

    if (bookingStatus === "COMPLETED") {
      return {
        canCancel: false,
        reason: "Completed bookings cannot be cancelled",
      };
    }

    const now = new Date();
    const hoursDiff = (checkInDate.getTime() - now.getTime()) / (1000 * 3600);

    // Simple cancellation policy check (can be made more sophisticated)
    if (hoursDiff < 24) {
      return {
        canCancel: false,
        reason: "Cannot cancel within 24 hours of check-in",
      };
    }

    return { canCancel: true };
  }

  // Sanitize search query
  static sanitizeSearchQuery(query: string): string {
    return query
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/gi, "")
      .substring(0, 100);
  }

  // Build search filters
  static buildSearchFilters(params: {
    category?: string;
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    amenities?: string[];
    guests?: number;
  }) {
    const where: any = {
      vendor: {
        status: "APPROVED",
      },
    };

    if (params.category) {
      where.category = params.category;
    }

    if (params.location) {
      where.vendor = {
        ...where.vendor,
        businessAddress: {
          contains: this.sanitizeSearchQuery(params.location),
          mode: "insensitive",
        },
      };
    }

    if (params.amenities && params.amenities.length > 0) {
      where.amenities = {
        hasEvery: params.amenities,
      };
    }

    return where;
  }

  // Get recommended hotels based on user preferences
  static async getRecommendedHotels(
    userId: string,
    limit: number = 5
  ): Promise<any[]> {
    // Simple recommendation based on user's booking history
    const userBookings = await prisma.booking.findMany({
      where: {
        userId,
        bookingType: "HOTEL",
      },
      include: {
        hotelBooking: {
          include: {
            hotelProfile: true,
          },
        },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    // Extract categories and locations from user's booking history
    const preferredCategories = userBookings
      .flatMap((booking) =>
        booking.hotelBooking?.map((hb) => hb.hotelProfile?.category)
      )
      .filter(Boolean);

    const categoryFilter =
      preferredCategories.length > 0 ? { in: preferredCategories } : undefined;

    return await prisma.hotelProfile.findMany({
      where: {
        vendor: { status: "APPROVED" },
        ...(categoryFilter && { category: categoryFilter }),
      },
      include: {
        vendor: {
          select: {
            businessName: true,
            businessAddress: true,
            images: {
              where: { imageType: "property" },
              take: 3,
            },
          },
        },
        rooms: {
          where: { isAvailable: true },
          orderBy: { basePrice: "asc" },
          take: 1,
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }
}

export default HotelUtils;

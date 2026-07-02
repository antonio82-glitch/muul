/**
 * GET /api/tickets/[token]   → verifica si el QR es válido
 * POST /api/tickets/[token]  → marca el ticket como canjeado (libera escrow)
 *
 * Solo el comercio dueño del servicio puede canjear el ticket.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, availabilitySlots, services, listings, orderItems, orders } from "@/lib/db/schema";
import { verifyQrToken } from "@/lib/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { capturePayment } from "@/lib/stripe/connect";

async function loadBookingWithContext(token: string) {
  if (!verifyQrToken(token)) return null;

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.qrToken, token),
  });
  if (!booking) return null;

  const slot = await db.query.availabilitySlots.findFirst({
    where: eq(availabilitySlots.id, booking.slotId),
  });
  if (!slot) return null;

  const service = await db.query.services.findFirst({
    where: eq(services.listingId, slot.serviceListingId),
  });
  if (!service) return null;

  const listing = await db.query.listings.findFirst({
    where: eq(listings.id, service.listingId),
  });
  if (!listing) return null;

  return { booking, slot, listing };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ctx2 = await loadBookingWithContext(token);
  if (!ctx2) return NextResponse.json({ valid: false }, { status: 404 });

  return NextResponse.json({
    valid: true,
    booking: {
      id: ctx2.booking.id,
      partySize: ctx2.booking.partySize,
      status: ctx2.booking.status,
      redeemedAt: ctx2.booking.redeemedAt,
    },
    listing: { id: ctx2.listing.id, title: ctx2.listing.title },
    slot: { startsAt: ctx2.slot.startsAt, endsAt: ctx2.slot.endsAt },
  });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx2 = await loadBookingWithContext(token);
  if (!ctx2) return NextResponse.json({ error: "Invalid ticket" }, { status: 404 });

  if (ctx2.booking.status !== "confirmed") {
    return NextResponse.json({ error: `Ticket already ${ctx2.booking.status}` }, { status: 400 });
  }

  // TODO: verificar que el user es admin del merchant del listing
  // (si tienes la tabla merchant_users disponible aquí, hazlo)

  // 1. Marcar booking como redeemed
  await db
    .update(bookings)
    .set({ status: "redeemed", redeemedAt: new Date() })
    .where(eq(bookings.id, ctx2.booking.id));

  // 2. Liberar escrow → capturar pago en Stripe
  if (ctx2.booking.orderItemId) {
    const orderItem = await db.query.orderItems.findFirst({
      where: eq(orderItems.id, ctx2.booking.orderItemId),
    });
    if (orderItem) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderItem.orderId),
      });
      if (order?.paymentIntentId && !order.capturedAt) {
        await capturePayment(order.paymentIntentId);
        await db
          .update(orders)
          .set({ status: "completed", capturedAt: new Date() })
          .where(eq(orders.id, order.id));
      }
    }
  }

  return NextResponse.json({ ok: true, redeemedAt: new Date() });
}

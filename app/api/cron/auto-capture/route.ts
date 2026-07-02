/**
 * GET /api/cron/auto-capture
 *
 * Captura automática de PaymentIntents que llevan más de 24h en escrow
 * sin haber sido canjeados. Esto:
 * - Libera fondos al comercio
 * - Marca la orden como completed
 *
 * Configurar en Vercel Cron (vercel.json):
 *   { "path": "/api/cron/auto-capture", "schedule": "0 * * * *" }  // cada hora
 *
 * Seguridad: validamos el header `Authorization: Bearer ${CRON_SECRET}`
 * (Vercel inyecta este header automáticamente en cron jobs).
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq, and, lt, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, orderItems, bookings } from "@/lib/db/schema";
import { capturePayment } from "@/lib/stripe/connect";

const SLA_HOURS = 24;

export async function GET(req: NextRequest) {
  // Validar que viene de Vercel Cron o admin
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

  // Órdenes pagadas, sin captura, más viejas que el SLA
  const candidates = await db.query.orders.findMany({
    where: and(
      eq(orders.status, "paid"),
      isNull(orders.capturedAt),
      lt(orders.createdAt, cutoff),
    ),
    limit: 100,
  });

  let captured = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const order of candidates) {
    if (!order.paymentIntentId) {
      skipped++;
      continue;
    }

    // Si la orden tiene servicios con bookings activos (no canjeados), saltar.
    // El comercio aún tiene tiempo de canjear o el cliente puede no haber llegado.
    const items = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, order.id),
    });
    const bookingIds = items.map((i) => i.bookingId).filter((b): b is string => !!b);
    if (bookingIds.length > 0) {
      const activeBookings = await db.query.bookings.findMany({
        where: and(
          inArray(bookings.id, bookingIds),
          eq(bookings.status, "confirmed"),
        ),
      });
      if (activeBookings.length > 0) {
        skipped++;
        continue;
      }
    }

    try {
      await capturePayment(order.paymentIntentId);
      await db
        .update(orders)
        .set({
          status: "completed",
          capturedAt: new Date(),
          escrowReleasedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
      captured++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      errors.push(`${order.id}: ${msg}`);
    }
  }

  return NextResponse.json({
    examined: candidates.length,
    captured,
    skipped,
    errors,
  });
}

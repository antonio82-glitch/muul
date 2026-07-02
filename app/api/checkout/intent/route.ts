/**
 * POST /api/checkout/intent
 *
 * Crea una orden + PaymentIntent con split y captura manual (escrow).
 * El cliente recibe { clientSecret } para confirmar el pago en el browser.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants, listings, orders, orderItems } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCheckoutIntent } from "@/lib/stripe/connect";

const checkoutSchema = z.object({
  merchantId: z.string().uuid(),
  items: z
    .array(
      z.object({
        listingId: z.string().uuid(),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Validar comercio
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, data.merchantId),
  });

  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }
  if (!merchant.stripeAccountId || !merchant.stripePayoutsEnabled) {
    return NextResponse.json({ error: "Merchant cannot accept payments yet" }, { status: 400 });
  }
  if (merchant.status !== "active") {
    return NextResponse.json({ error: "Merchant not active" }, { status: 400 });
  }

  // 2. Cargar listings y validar precios (snapshot al momento de comprar)
  const listingIds = data.items.map((i) => i.listingId);
  const dbListings = await db.query.listings.findMany({
    where: inArray(listings.id, listingIds),
  });

  if (dbListings.length !== listingIds.length) {
    return NextResponse.json({ error: "Some listings not found" }, { status: 400 });
  }
  if (dbListings.some((l) => l.merchantId !== data.merchantId)) {
    return NextResponse.json({ error: "Items belong to different merchants" }, { status: 400 });
  }
  if (dbListings.some((l) => l.status !== "live")) {
    return NextResponse.json({ error: "Some listings are not available" }, { status: 400 });
  }

  // 3. Calcular totales (todo en cents, sin floats)
  const itemsWithPrice = data.items.map((req) => {
    const listing = dbListings.find((l) => l.id === req.listingId)!;
    return {
      listing,
      qty: req.qty,
      lineCents: listing.priceCents * req.qty,
    };
  });

  const subtotalCents = itemsWithPrice.reduce((sum, i) => sum + i.lineCents, 0);
  const commissionPct = Number(merchant.commissionPct);
  const feeCents = Math.round(subtotalCents * commissionPct);
  const totalCents = subtotalCents; // El cliente paga subtotal; Múul retiene fee del comercio
  const currency = itemsWithPrice[0]!.listing.currency;

  // 4. Crear orden en DB (status: pending)
  const [order] = await db
    .insert(orders)
    .values({
      customerId: user?.id,
      merchantId: merchant.id,
      status: "pending",
      currency,
      subtotalCents,
      feeCents,
      totalCents,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
    })
    .returning();

  if (!order) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // 5. Crear order_items
  await db.insert(orderItems).values(
    itemsWithPrice.map((i) => ({
      orderId: order.id,
      listingId: i.listing.id,
      titleSnapshot: i.listing.title,
      qty: i.qty,
      unitPriceCents: i.listing.priceCents,
    })),
  );

  // 6. Crear PaymentIntent en Stripe
  const intent = await createCheckoutIntent({
    totalCents,
    commissionPct,
    merchantStripeAccountId: merchant.stripeAccountId,
    currency: currency.toLowerCase() as "mxn" | "usd" | "eur",
    customerEmail: data.customerEmail,
    metadata: {
      order_id: order.id,
      merchant_id: merchant.id,
    },
  });

  // 7. Guardar payment_intent_id
  await db
    .update(orders)
    .set({ paymentIntentId: intent.id })
    .where(eq(orders.id, order.id));

  return NextResponse.json({
    orderId: order.id,
    clientSecret: intent.client_secret,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    accountId: merchant.stripeAccountId, // necesario para Stripe.js Connect
  });
}

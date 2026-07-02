/**
 * POST /api/webhooks/stripe
 *
 * Handler de eventos críticos. Stripe es el source-of-truth de pagos —
 * cuando recibe el pago, dispara este webhook y actualizamos nuestra DB.
 *
 * Eventos manejados:
 * - payment_intent.succeeded → orden pagada, emitir QR ticket
 * - payment_intent.payment_failed → marcar orden como cancelled
 * - charge.refunded → reembolso procesado
 * - account.updated → KYC del merchant completado
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { orders, orderItems, merchants } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { orderConfirmedEmail } from "@/lib/email/templates/order-confirmed";

export const runtime = "nodejs"; // necesario para verificar firma con crypto

export async function POST(req: NextRequest) {
  const body = await req.text(); // raw body para verificar firma
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`[stripe-webhook] ${event.type} ${event.id}`);

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const orderId = pi.metadata.order_id;
        if (!orderId) break;

        const [updatedOrder] = await db
          .update(orders)
          .set({
            status: "paid",
            paymentMethod: pi.payment_method_types?.[0] ?? null,
          })
          .where(eq(orders.id, orderId))
          .returning();

        if (!updatedOrder) break;

        // Cargar contexto para el email
        const merchant = await db.query.merchants.findFirst({
          where: eq(merchants.id, updatedOrder.merchantId),
        });
        const items = await db.query.orderItems.findMany({
          where: eq(orderItems.orderId, updatedOrder.id),
        });

        if (merchant && items.length > 0) {
          const { subject, html } = orderConfirmedEmail({
            customerName: updatedOrder.customerName,
            merchantName: merchant.name,
            orderId: updatedOrder.id,
            totalCents: updatedOrder.totalCents,
            currency: updatedOrder.currency,
            items: items.map((i) => ({
              title: i.titleSnapshot,
              qty: i.qty,
              lineCents: i.unitPriceCents * i.qty,
            })),
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            locale: "es",
          });

          await sendEmail({
            to: updatedOrder.customerEmail,
            userId: updatedOrder.customerId ?? undefined,
            template: "order_confirmed",
            subject,
            html,
            payload: { orderId: updatedOrder.id },
          });
        }

        // TODO: emitir QR tickets si la orden tiene servicios (booking creation)
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const orderId = pi.metadata.order_id;
        if (!orderId) break;

        await db
          .update(orders)
          .set({ status: "cancelled" })
          .where(eq(orders.id, orderId));
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const orderId = charge.metadata.order_id;
        if (!orderId) break;

        await db
          .update(orders)
          .set({ status: "refunded" })
          .where(eq(orders.id, orderId));
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const detailsSubmitted = account.details_submitted ?? false;

        // Encontrar el merchant por stripe_account_id
        const merchant = await db.query.merchants.findFirst({
          where: eq(merchants.stripeAccountId, account.id),
        });
        if (!merchant) break;

        await db
          .update(merchants)
          .set({
            stripeOnboarded: detailsSubmitted,
            stripePayoutsEnabled: payoutsEnabled,
            status: payoutsEnabled ? "active" : "kyc_required",
          })
          .where(eq(merchants.id, merchant.id));
        break;
      }

      default:
        console.log(`[stripe-webhook] unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe-webhook] handler error", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

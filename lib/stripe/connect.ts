/**
 * Stripe Connect Express — helpers de onboarding y checkout.
 *
 * Modelo:
 * - Cada comercio tiene su propia cuenta Stripe Connect Express.
 * - Múul usa "destination charges" con application_fee.
 * - Captura manual = escrow hasta que se confirme entrega.
 */
import type Stripe from "stripe";
import { stripe } from "./client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Crea la cuenta Stripe Connect para un comercio nuevo.
 */
export async function createConnectAccount(params: {
  email: string;
  businessName: string;
  country?: string;
}) {
  return stripe.accounts.create({
    type: "express",
    country: params.country ?? "MX",
    email: params.email,
    business_type: "individual",
    business_profile: {
      name: params.businessName,
      mcc: "5999", // miscellaneous specialty retail
      url: APP_URL.includes("localhost") ? "https://muul.mx" : `${APP_URL}/m/${params.businessName.toLowerCase().replace(/\s+/g, "-")}`,
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payouts: {
        schedule: { interval: "daily", delay_days: 7 },
      },
    },
  });
}

/**
 * Genera el link de KYC. Después de completarlo, Stripe redirige a return_url.
 */
export async function createOnboardingLink(accountId: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/onboarding/retry`,
    return_url: `${APP_URL}/onboarding/done?account=${accountId}`,
    type: "account_onboarding",
  });
}

/**
 * Login link al dashboard de Stripe del comercio (para que vea sus payouts).
 */
export async function createDashboardLink(accountId: string) {
  return stripe.accounts.createLoginLink(accountId);
}

/**
 * Crea un PaymentIntent con split y captura manual (escrow).
 *
 * @param totalCents - lo que paga el cliente, en cents
 * @param commissionPct - % de comisión Múul (ej. 0.08)
 * @param merchantStripeAccountId - cuenta Connect del comercio
 * @param currency - "mxn" | "usd" | "eur"
 * @param metadata - order_id, merchant_id, etc.
 */
export async function createCheckoutIntent(params: {
  totalCents: number;
  commissionPct: number;
  merchantStripeAccountId: string;
  currency: "mxn" | "usd" | "eur";
  customerEmail: string;
  metadata: Record<string, string>;
}) {
  const applicationFee = Math.round(params.totalCents * params.commissionPct);

  return stripe.paymentIntents.create({
    amount: params.totalCents,
    currency: params.currency,
    application_fee_amount: applicationFee,
    transfer_data: {
      destination: params.merchantStripeAccountId,
    },
    capture_method: "manual", // ← escrow
    receipt_email: params.customerEmail,
    metadata: params.metadata,
    automatic_payment_methods: { enabled: true },
  });
}

/**
 * Captura el pago (libera escrow). Llamar cuando el cliente recibió el bien
 * o canjeó el QR del servicio.
 */
export async function capturePayment(paymentIntentId: string) {
  return stripe.paymentIntents.capture(paymentIntentId);
}

/**
 * Cancela un PaymentIntent (devuelve fondos al cliente, sin transferir al comercio).
 */
export async function cancelPayment(paymentIntentId: string, reason?: string) {
  return stripe.paymentIntents.cancel(paymentIntentId, {
    cancellation_reason: reason as Stripe.PaymentIntentCancelParams.CancellationReason,
  });
}

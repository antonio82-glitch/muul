"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

type CheckoutData = {
  clientSecret: string;
  publishableKey: string;
  accountId: string;
};

export function CheckoutForm({ orderId, locale }: { orderId: string; locale: "es" | "en" }) {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<StripeJs | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`muul:checkout:${orderId}`);
    if (!raw) {
      setError(
        locale === "es"
          ? "Sesión expirada. Vuelve al producto e intenta de nuevo."
          : "Session expired. Go back to the listing and try again.",
      );
      return;
    }
    const parsed = JSON.parse(raw) as CheckoutData;
    setData(parsed);
    // Stripe Connect: pasar stripeAccount al loadStripe
    setStripePromise(
      loadStripe(parsed.publishableKey, { stripeAccount: parsed.accountId }),
    );
  }, [orderId, locale]);

  if (error) {
    return (
      <div className="border-l-2 border-coral pl-4 py-3 bg-coral-soft">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!data || !stripePromise) {
    return (
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-tinta/50">
        {locale === "es" ? "Cargando…" : "Loading…"}
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: data.clientSecret,
        locale: locale === "es" ? "es-419" : "en",
        appearance: {
          theme: "flat",
          variables: {
            colorPrimary: "#FF6B47",
            colorBackground: "#F4EFE6",
            colorText: "#0A0E1A",
            colorDanger: "#DC2626",
            fontFamily: "DM Sans, system-ui, sans-serif",
            borderRadius: "4px",
            spacingUnit: "4px",
          },
        },
      }}
    >
      <PaymentForm orderId={orderId} locale={locale} />
    </Elements>
  );
}

function PaymentForm({ orderId, locale }: { orderId: string; locale: "es" | "en" }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${locale}/checkout/${orderId}/done`,
      },
    });

    // Solo llegamos aquí si hay error inmediato (validación, red, etc.)
    if (error) {
      setError(error.message ?? "Error procesando pago");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && (
        <div className="border-l-2 border-coral pl-4 py-2 bg-coral-soft">
          <p className="text-sm">{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="bg-tinta text-hueso w-full px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition disabled:opacity-40"
      >
        {submitting
          ? locale === "es" ? "Procesando…" : "Processing…"
          : locale === "es" ? "Confirmar pago →" : "Confirm payment →"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  capacityRemaining: number;
};

export function ListingActions({
  listing,
  slots,
  locale,
}: {
  listing: {
    id: string;
    type: "product" | "service";
    title: string;
    priceCents: number;
    currency: "MXN" | "USD" | "EUR";
    merchantId: string;
    merchantPayoutsEnabled: boolean;
  };
  slots: Slot[];
  locale: "es" | "en";
}) {
  const router = useRouter();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!listing.merchantPayoutsEnabled) {
    return (
      <div className="border border-tinta/20 rounded-sm p-6 bg-hueso-2">
        <p className="label mb-2">
          {locale === "es" ? "Comercio en preparación" : "Business preparing"}
        </p>
        <p className="text-sm text-tinta/70">
          {locale === "es"
            ? "Este comercio aún no está habilitado para recibir pagos. Vuelve pronto."
            : "This business isn't ready to accept payments yet. Check back soon."}
        </p>
      </div>
    );
  }

  if (listing.type === "service" && slots.length === 0) {
    return (
      <div className="border border-tinta/20 rounded-sm p-6 bg-hueso-2">
        <p className="label mb-2">{locale === "es" ? "Sin disponibilidad" : "Unavailable"}</p>
        <p className="text-sm text-tinta/70">
          {locale === "es" ? "No hay horarios disponibles." : "No slots available."}
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/checkout/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantId: listing.merchantId,
        items: [{ listingId: listing.id, qty }],
        customerEmail: email,
        customerName: name || undefined,
        // TODO: pasar slotId si es servicio (la API debería crear el booking)
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Error");
      setSubmitting(false);
      return;
    }

    const data = await res.json();

    // Guardar clientSecret en sessionStorage (no en URL — secret)
    sessionStorage.setItem(
      `muul:checkout:${data.orderId}`,
      JSON.stringify({
        clientSecret: data.clientSecret,
        publishableKey: data.publishableKey,
        accountId: data.accountId,
      }),
    );

    router.push(`/${locale}/checkout/${data.orderId}`);
  }

  const totalCents = listing.priceCents * qty;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 border-t border-tinta/10 pt-6">
      {/* Slot picker para servicios */}
      {listing.type === "service" && (
        <div>
          <p className="label mb-3">{locale === "es" ? "Elige horario" : "Pick a time"}</p>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {slots.slice(0, 12).map((s) => {
              const date = new Date(s.startsAt);
              const isSelected = selectedSlotId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSlotId(s.id)}
                  disabled={s.capacityRemaining === 0}
                  className={`p-3 rounded-sm border text-left transition ${
                    isSelected
                      ? "border-coral bg-coral-soft"
                      : "border-tinta/10 hover:border-turquesa"
                  } disabled:opacity-30`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-coral">
                    {date.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <p className="font-display text-lg">
                    {date.toLocaleTimeString(locale === "es" ? "es-MX" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Qty para productos */}
      {listing.type === "product" && (
        <div>
          <p className="label mb-2">{locale === "es" ? "Cantidad" : "Quantity"}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-10 h-10 border border-tinta/20 rounded-sm hover:border-coral"
            >
              −
            </button>
            <span className="font-display text-2xl w-12 text-center">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              className="w-10 h-10 border border-tinta/20 rounded-sm hover:border-coral"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Datos de contacto */}
      <div>
        <label className="label mb-2 block">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none"
          placeholder="tu@correo.com"
        />
      </div>

      <div>
        <label className="label mb-2 block">{locale === "es" ? "Nombre" : "Name"}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none"
        />
      </div>

      {error && (
        <div className="border-l-2 border-coral pl-4 py-2 bg-coral-soft">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={
          submitting ||
          !email ||
          (listing.type === "service" && !selectedSlotId)
        }
        className="bg-tinta text-hueso w-full px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition disabled:opacity-40"
      >
        {submitting
          ? locale === "es" ? "Procesando…" : "Processing…"
          : `${locale === "es" ? "Pagar" : "Pay"} ${(totalCents / 100).toFixed(2)} ${listing.currency}`}
      </button>
    </form>
  );
}

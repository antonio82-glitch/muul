"use client";

import { useEffect, useRef, useState } from "react";

type ScannedTicket = {
  valid: boolean;
  booking?: {
    id: string;
    partySize: number;
    status: string;
    redeemedAt: string | null;
  };
  listing?: { id: string; title: string };
  slot?: { startsAt: string; endsAt: string };
};

export function TicketScanner({ locale }: { locale: "es" | "en" }) {
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScannedTicket | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);

  // Iniciar escáner cuando se activa la cámara
  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    let stopped = false;
    (async () => {
      try {
        const QrScanner = (await import("qr-scanner")).default;
        const scanner = new QrScanner(
          videoRef.current!,
          (res) => {
            if (stopped) return;
            setToken(res.data);
            setScanning(false);
            verifyToken(res.data);
          },
          { highlightScanRegion: true, highlightCodeOutline: true },
        );
        scannerRef.current = scanner;
        await scanner.start();
      } catch (err) {
        setError(
          locale === "es"
            ? "No pudimos acceder a la cámara. Pega el código manualmente."
            : "Couldn't access camera. Paste the code manually.",
        );
        setScanning(false);
      }
    })();

    return () => {
      stopped = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [scanning, locale]);

  async function verifyToken(t: string) {
    setError(null);
    setSuccess(false);
    setResult(null);
    const res = await fetch(`/api/tickets/${encodeURIComponent(t)}`);
    if (!res.ok) {
      setError(locale === "es" ? "Pase no válido" : "Invalid pass");
      return;
    }
    const data = (await res.json()) as ScannedTicket;
    setResult(data);
  }

  async function handleRedeem() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/tickets/${encodeURIComponent(token)}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? (locale === "es" ? "Error" : "Error"));
      setSubmitting(false);
      return;
    }
    setSuccess(true);
    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      {!scanning && !success && (
        <button
          type="button"
          onClick={() => {
            setScanning(true);
            setResult(null);
            setError(null);
          }}
          className="w-full border border-tinta/20 px-4 py-6 rounded-sm hover:border-coral hover:text-coral transition font-mono text-xs uppercase tracking-[0.2em]"
        >
          📷 {locale === "es" ? "Abrir cámara" : "Open camera"}
        </button>
      )}

      {scanning && (
        <div className="relative aspect-square bg-tinta rounded-sm overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => setScanning(false)}
            className="absolute top-3 right-3 bg-coral text-hueso px-3 py-1 rounded-sm text-xs font-mono uppercase tracking-[0.15em]"
          >
            {locale === "es" ? "Cancelar" : "Cancel"}
          </button>
        </div>
      )}

      {!scanning && (
        <>
          <p className="label">{locale === "es" ? "O pega el código" : "Or paste the code"}</p>
          <div className="flex gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="flex-1 bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-mono text-sm"
              placeholder="abc123…"
            />
            <button
              type="button"
              onClick={() => verifyToken(token)}
              disabled={!token}
              className="bg-tinta text-hueso px-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] disabled:opacity-40"
            >
              {locale === "es" ? "Verificar" : "Verify"}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="border-l-2 border-coral pl-4 py-2 bg-coral-soft">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {result && result.valid && result.booking && (
        <div className="border border-turquesa/30 rounded-sm p-6 bg-turquesa-soft space-y-3">
          <p className="label text-turquesa-deep">
            {locale === "es" ? "✓ Pase válido" : "✓ Valid pass"}
          </p>
          {result.listing && <p className="font-display text-xl">{result.listing.title}</p>}
          {result.slot && (
            <p className="text-sm text-tinta/70">
              {new Date(result.slot.startsAt).toLocaleString(
                locale === "es" ? "es-MX" : "en-US",
                { dateStyle: "full", timeStyle: "short" },
              )}
            </p>
          )}
          <p className="font-mono text-xs">
            {locale === "es" ? "Personas" : "Party"}: {result.booking.partySize}
          </p>

          {result.booking.status === "confirmed" ? (
            <button
              type="button"
              onClick={handleRedeem}
              disabled={submitting}
              className="w-full bg-coral text-hueso px-6 py-3 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:opacity-90 transition disabled:opacity-40"
            >
              {submitting
                ? locale === "es" ? "Canjeando…" : "Redeeming…"
                : locale === "es" ? "Canjear y liberar pago →" : "Redeem and release payment →"}
            </button>
          ) : (
            <p className="text-sm text-tinta/60 italic">
              {locale === "es" ? "Estado" : "Status"}: {result.booking.status}
            </p>
          )}
        </div>
      )}

      {success && (
        <div className="border border-turquesa rounded-sm p-6 bg-turquesa text-tinta">
          <p className="label mb-2">✓ {locale === "es" ? "Canjeado" : "Redeemed"}</p>
          <p className="font-display text-xl">
            {locale === "es" ? "Pago liberado al comercio." : "Payment released to merchant."}
          </p>
        </div>
      )}
    </div>
  );
}

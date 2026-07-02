"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/brand/wordmark";

export default function SignInPage() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSent(true);
    setSubmitting(false);
  }

  return (
    <section className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <Wordmark className="text-5xl mb-12 block text-center" />

        {sent ? (
          <div className="text-center">
            <p className="label text-coral mb-4">Revisa tu correo</p>
            <h1 className="display-md mb-4">Te enviamos un enlace mágico.</h1>
            <p className="text-tinta/70">
              Abre el correo en <strong>{email}</strong> y haz click en el enlace para entrar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <p className="label mb-3">Acceso</p>
              <h1 className="display-lg mb-3">Entra a Múul.</h1>
              <p className="text-tinta/70">
                Sin contraseñas. Te mandamos un enlace mágico a tu correo.
              </p>
            </div>

            <div>
              <label className="label mb-2 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-display text-xl"
                placeholder="tu@correo.com"
                autoFocus
              />
            </div>

            {error && (
              <div className="border-l-2 border-coral pl-4 py-2 bg-coral-soft">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !email}
              className="bg-tinta text-hueso w-full px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition disabled:opacity-40"
            >
              {submitting ? "Enviando…" : "Enviar enlace mágico →"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

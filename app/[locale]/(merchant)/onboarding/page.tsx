"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  city: z.string().optional(),
  description: z.string().min(20).optional(),
});

type FormData = z.infer<typeof schema>;

export default function OnboardingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(slug: string): Promise<string | null> {
    if (!logoFile) return null;
    const supabase = createSupabaseBrowserClient();
    const ext = logoFile.name.split(".").pop();
    const path = `logos/${slug}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("listings")
      .upload(path, logoFile, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("listings").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError(null);

    const slug = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const logoUrl = await uploadLogo(slug);

    const res = await fetch("/api/merchants/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, logoUrl }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Error desconocido");
      setSubmitting(false);
      return;
    }
    const { kycUrl } = await res.json();
    window.location.href = kycUrl;
  }

  return (
    <section className="px-6 py-20 max-w-2xl mx-auto">
      <p className="label mb-3">/ Onboarding</p>
      <h1 className="display-lg mb-4">Une tu comercio a Múul.</h1>
      <p className="text-tinta/70 mb-12 max-w-lg">
        Tres pasos: cuéntanos de tu negocio, verifica tu identidad con Stripe (8 min) y carga
        tu primer producto.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Logo */}
        <div>
          <label className="label mb-2 block">Logo del comercio</label>
          <label className="block cursor-pointer">
            {logoPreview ? (
              <img src={logoPreview} alt="logo preview" className="w-32 h-32 object-cover rounded-full border border-tinta/10" />
            ) : (
              <div className="w-32 h-32 border border-dashed border-tinta/20 rounded-full flex items-center justify-center text-tinta/40 text-xs text-center hover:border-turquesa transition px-2">
                Subir logo
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleLogoChange} className="sr-only" />
          </label>
          {logoPreview && (
            <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="mt-2 text-xs text-coral underline">
              Quitar logo
            </button>
          )}
        </div>

        <Field label="Nombre del comercio" error={errors.name?.message}>
          <input
            {...register("name")}
            className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-display text-xl"
            placeholder="ej. Café Cenote"
          />
        </Field>

        <Field label="Email de contacto" error={errors.email?.message}>
          <input
            {...register("email")}
            type="email"
            className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none"
            placeholder="hola@cafecenote.mx"
          />
        </Field>

        <Field label="Teléfono / WhatsApp" error={errors.phone?.message}>
          <input
            {...register("phone")}
            className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-mono"
            placeholder="+52 998 ..."
          />
        </Field>

        <Field label="Ciudad" error={errors.city?.message}>
          <input
            {...register("city")}
            className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none"
            placeholder="Tulum"
          />
        </Field>

        <Field label="Cuéntanos qué te hace especial" error={errors.description?.message}>
          <textarea
            {...register("description")}
            rows={4}
            className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none resize-none"
            placeholder="Comercio familiar, café de origen Chiapas, terraza con vista al mar…"
          />
        </Field>

        {error && (
          <div className="border-l-2 border-coral pl-4 py-2 bg-coral-soft">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-tinta text-hueso px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition disabled:opacity-40"
        >
          {submitting ? "Procesando…" : "Continuar a verificación →"}
        </button>
      </form>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label mb-2 block">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-coral">{error}</p>}
    </div>
  );
}
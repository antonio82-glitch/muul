"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const schema = z.object({
  type: z.enum(["product", "service"]),
  title: z.string().min(2).max(120),
  description: z.string().min(10).optional(),
  priceMxn: z.coerce.number().positive(),
  currency: z.enum(["MXN", "USD", "EUR"]).default("MXN"),
  inventoryQty: z.coerce.number().int().nonnegative().optional(),
  durationMin: z.coerce.number().int().positive().optional(),
  capacity: z.coerce.number().int().positive().optional(),
});

type FormData = z.infer<typeof schema>;

export function ListingForm({ locale }: { locale: "es" | "en" }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "product", currency: "MXN" },
  });

  const type = watch("type");

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(listingSlug: string): Promise<string | null> {
    if (!imageFile) return null;
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const ext = imageFile.name.split(".").pop();
    const path = `${listingSlug}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("listings")
      .upload(path, imageFile, { upsert: true });
    setUploading(false);
    if (error) return null;
    const { data } = supabase.storage.from("listings").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setError(null);

    const slug = slugify(data.title);
    const imageUrl = await uploadImage(slug);

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: data.type,
        title: data.title,
        slug,
        description: data.description,
        priceCents: Math.round(data.priceMxn * 100),
        currency: data.currency,
        inventoryQty: data.inventoryQty,
        durationMin: data.durationMin,
        capacity: data.capacity,
        images: imageUrl ? [imageUrl] : [],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Error desconocido");
      setSubmitting(false);
      return;
    }

    router.push(`/${locale}/catalogo`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div>
        <p className="label mb-3">{locale === "es" ? "Tipo" : "Type"}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="border border-tinta/10 rounded-sm p-4 cursor-pointer has-[:checked]:border-coral has-[:checked]:bg-coral-soft">
            <input type="radio" value="product" {...register("type")} className="sr-only" />
            <p className="font-display text-xl mb-1">{locale === "es" ? "Producto" : "Product"}</p>
            <p className="text-xs text-tinta/60">{locale === "es" ? "Café, ropa, artesanía…" : "Coffee, apparel, crafts…"}</p>
          </label>
          <label className="border border-tinta/10 rounded-sm p-4 cursor-pointer has-[:checked]:border-coral has-[:checked]:bg-coral-soft">
            <input type="radio" value="service" {...register("type")} className="sr-only" />
            <p className="font-display text-xl mb-1">{locale === "es" ? "Servicio" : "Service"}</p>
            <p className="text-xs text-tinta/60">{locale === "es" ? "Tour, spa, clase, renta…" : "Tour, spa, class, rental…"}</p>
          </label>
        </div>
      </div>

      <div>
        <p className="label mb-3">{locale === "es" ? "Foto" : "Photo"}</p>
        <label className="block cursor-pointer">
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="w-full h-48 object-cover rounded-sm border border-tinta/10" />
          ) : (
            <div className="w-full h-48 border border-dashed border-tinta/20 rounded-sm flex items-center justify-center text-tinta/40 text-sm hover:border-turquesa transition">
              {locale === "es" ? "Haz click para subir una foto" : "Click to upload a photo"}
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
        </label>
        {imagePreview && (
          <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="mt-2 text-xs text-coral underline">
            {locale === "es" ? "Quitar foto" : "Remove photo"}
          </button>
        )}
      </div>

      <div>
        <label className="label mb-2 block">{locale === "es" ? "Título" : "Title"}</label>
        <input {...register("title")} className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-display text-xl" placeholder={locale === "es" ? "ej. Tour cenotes Cobá" : "e.g. Cobá cenotes tour"} />
        {errors.title && <p className="mt-1 text-xs text-coral">{errors.title.message}</p>}
      </div>

      <div>
        <label className="label mb-2 block">{locale === "es" ? "Descripción" : "Description"}</label>
        <textarea {...register("description")} rows={4} className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none resize-none" />
        {errors.description && <p className="mt-1 text-xs text-coral">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="label mb-2 block">{locale === "es" ? "Precio" : "Price"}</label>
          <input {...register("priceMxn")} type="number" step="0.01" min="0" className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-mono" placeholder="0.00" />
        </div>
        <div>
          <p className="label mb-2">Moneda</p>
          <select {...register("currency")} className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-mono">
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      {type === "product" && (
        <div>
          <label className="label mb-2 block">{locale === "es" ? "Inventario" : "Inventory"}</label>
          <input {...register("inventoryQty")} type="number" min="0" className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-mono" placeholder="0" />
        </div>
      )}

      {type === "service" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-2 block">{locale === "es" ? "Duración (min)" : "Duration (min)"}</label>
            <input {...register("durationMin")} type="number" min="1" className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-mono" placeholder="60" />
          </div>
          <div>
            <label className="label mb-2 block">{locale === "es" ? "Capacidad" : "Capacity"}</label>
            <input {...register("capacity")} type="number" min="1" defaultValue="1" className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none font-mono" />
          </div>
        </div>
      )}

      {error && (
        <div className="border-l-2 border-coral pl-4 py-2 bg-coral-soft">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <button type="submit" disabled={submitting || uploading} className="bg-tinta text-hueso px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition disabled:opacity-40">
        {uploading ? (locale === "es" ? "Subiendo foto…" : "Uploading photo…") : submitting ? (locale === "es" ? "Creando…" : "Creating…") : (locale === "es" ? "Crear listing →" : "Create listing →")}
      </button>
    </form>
  );
}
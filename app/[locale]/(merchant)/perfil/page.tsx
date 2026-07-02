"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", city: "", contactPhone: "", whatsapp: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/merchants/profile").then(r => r.json()).then(data => {
      setMerchant(data);
      setForm({
        name: data.name ?? "",
        description: data.description ?? "",
        city: data.city ?? "",
        contactPhone: data.contactPhone ?? "",
        whatsapp: data.whatsapp ?? "",
      });
      setLogoPreview(data.logoUrl ?? null);
      setCoverPreview(data.coverUrl ?? null);
      setLoading(false);
    });
  }, []);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "cover") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === "logo") { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
    else { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  }

  async function uploadImage(file: File, path: string): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split(".").pop();
    const fullPath = `${path}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("Listings").upload(fullPath, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("Listings").getPublicUrl(fullPath);
    return data.publicUrl;
  }

  async function handleSave() {
    setSaving(true);
    let logoUrl = merchant?.logoUrl ?? null;
    let coverUrl = merchant?.coverUrl ?? null;
    if (logoFile) logoUrl = await uploadImage(logoFile, `logos/${merchant.slug}`);
    if (coverFile) coverUrl = await uploadImage(coverFile, `covers/${merchant.slug}`);
    await fetch("/api/merchants/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, logoUrl, coverUrl }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div className="px-6 py-20 text-tinta/40">Cargando…</div>;

  return (
    <section className="px-6 py-12 max-w-2xl mx-auto">
      <p className="label mb-3">/ Perfil</p>
      <h1 className="display-lg mb-12">Editar comercio</h1>

      <div className="space-y-8">
        {/* Logo */}
        <div>
          <p className="label mb-3">Logo</p>
          <label className="block cursor-pointer w-32">
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="w-32 h-32 object-cover rounded-full border border-tinta/10" />
            ) : (
              <div className="w-32 h-32 border border-dashed border-tinta/20 rounded-full flex items-center justify-center text-tinta/40 text-xs text-center hover:border-turquesa transition">
                Subir logo
              </div>
            )}
            <input type="file" accept="image/*" onChange={e => handleImageChange(e, "logo")} className="sr-only" />
          </label>
        </div>

        {/* Cover */}
        <div>
          <p className="label mb-3">Foto de portada</p>
          <label className="block cursor-pointer">
            {coverPreview ? (
              <img src={coverPreview} alt="cover" className="w-full h-40 object-cover rounded-sm border border-tinta/10" />
            ) : (
              <div className="w-full h-40 border border-dashed border-tinta/20 rounded-sm flex items-center justify-center text-tinta/40 text-sm hover:border-turquesa transition">
                Subir foto de portada
              </div>
            )}
            <input type="file" accept="image/*" onChange={e => handleImageChange(e, "cover")} className="sr-only" />
          </label>
        </div>

        {/* Campos */}
        {[
          { key: "name", label: "Nombre" },
          { key: "description", label: "Descripción" },
          { key: "city", label: "Ciudad" },
          { key: "contactPhone", label: "Teléfono" },
          { key: "whatsapp", label: "WhatsApp" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="label mb-2 block">{label}</label>
            <input
              value={(form as any)[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full bg-transparent border-b border-tinta/20 py-3 px-1 focus:border-turquesa outline-none"
            />
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-tinta text-hueso px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition disabled:opacity-40"
        >
          {saving ? "Guardando…" : saved ? "¡Guardado ✓" : "Guardar cambios →"}
        </button>
      </div>
    </section>
  );
}
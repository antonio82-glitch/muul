/**
 * Helpers de Supabase Storage.
 * Política: cada comercio tiene su propio "directorio" en el bucket `merchant-assets`.
 *
 * Setup en Supabase dashboard:
 * 1. Storage → New bucket: `merchant-assets` (public)
 * 2. Policy: solo merchant admins pueden insertar/borrar; lectura pública.
 *    Ver `lib/db/migrations/0002_storage_policies.sql`
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const BUCKET = "merchant-assets";

/**
 * Genera un path único para una imagen de comercio o listing.
 * Formato: {merchantId}/{kind}/{timestamp}-{random}.{ext}
 */
export function buildAssetPath(params: {
  merchantId: string;
  kind: "logo" | "cover" | "listing";
  filename: string;
}): string {
  const ext = params.filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${params.merchantId}/${params.kind}/${id}.${ext}`;
}

/**
 * Devuelve una URL firmada de subida (válida 60 segundos).
 * El cliente sube directo a Supabase, no pasa por nuestro server.
 */
export async function createSignedUploadUrl(path: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}

/**
 * Devuelve la URL pública de un asset (asume bucket público).
 */
export function publicAssetUrl(path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Elimina un asset (solo desde server, con admin client).
 */
export async function deleteAsset(path: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

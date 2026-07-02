/**
 * POST /api/uploads/sign
 *
 * Devuelve una URL firmada para que el cliente suba directo a Supabase Storage
 * sin que el archivo pase por nuestro server.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchantUsers } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAssetPath, createSignedUploadUrl, publicAssetUrl } from "@/lib/storage/upload";

const schema = z.object({
  filename: z.string().min(1),
  kind: z.enum(["logo", "cover", "listing"]),
  contentType: z.string().regex(/^image\/(jpeg|png|webp)$/),
});

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await db.query.merchantUsers.findFirst({
    where: eq(merchantUsers.userId, user.id),
  });
  if (!link) return NextResponse.json({ error: "No merchant" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const path = buildAssetPath({
    merchantId: link.merchantId,
    kind: parsed.data.kind,
    filename: parsed.data.filename,
  });

  try {
    const signed = await createSignedUploadUrl(path);
    return NextResponse.json({
      path,
      uploadUrl: signed.signedUrl,
      token: signed.token,
      publicUrl: publicAssetUrl(path),
    });
  } catch (err) {
    console.error("[upload-sign]", err);
    return NextResponse.json({ error: "Failed to sign upload" }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { merchants, merchantUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getMerchant(userId: string) {
  const link = await db.query.merchantUsers.findFirst({ where: eq(merchantUsers.userId, userId) });
  if (!link) return null;
  return db.query.merchants.findFirst({ where: eq(merchants.id, link.merchantId) });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const merchant = await getMerchant(user.id);
  if (!merchant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(merchant);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const merchant = await getMerchant(user.id);
  if (!merchant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  await db.update(merchants).set({
    name: body.name,
    description: body.description,
    city: body.city,
    contactPhone: body.contactPhone,
    whatsapp: body.whatsapp,
    logoUrl: body.logoUrl,
    coverUrl: body.coverUrl,
  }).where(eq(merchants.id, merchant.id));
  return NextResponse.json({ ok: true });
}
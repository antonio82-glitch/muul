/**
 * POST /api/merchants/onboard
 *
 * 1. Crea el merchant en DB
 * 2. Crea cuenta Stripe Connect Express
 * 3. Vincula al usuario actual como owner
 * 4. Devuelve el link de KYC para completar onboarding
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { merchants, merchantUsers } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createConnectAccount, createOnboardingLink } from "@/lib/stripe/connect";
import { slugify } from "@/lib/utils";

const onboardSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  categoryId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate body
  const body = await req.json().catch(() => ({}));
  const parsed = onboardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    // 1. Crear cuenta Stripe Connect
    const account = await createConnectAccount({
      email: data.email,
      businessName: data.name,
    });

    // 2. Insertar merchant en DB
    const [merchant] = await db
      .insert(merchants)
      .values({
        slug,
        name: data.name,
        description: data.description,
        contactEmail: data.email,
        contactPhone: data.phone,
        city: data.city,
        categoryId: data.categoryId,
        stripeAccountId: account.id,
        logoUrl: data.logoUrl,
        status: "kyc_required",
      })
      .returning();

    if (!merchant) {
      return NextResponse.json({ error: "Failed to create merchant" }, { status: 500 });
    }

    // 3. Vincular usuario como owner
    await db.insert(merchantUsers).values({
      merchantId: merchant.id,
      userId: user.id,
      role: "owner",
    });

    // 4. Generar link de KYC
    const link = await createOnboardingLink(account.id);

    return NextResponse.json({
      merchantId: merchant.id,
      slug: merchant.slug,
      kycUrl: link.url,
    });
  } catch (err) {
    console.error("[merchant-onboard]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

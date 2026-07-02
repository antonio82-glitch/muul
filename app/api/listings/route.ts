/**
 * POST /api/listings
 *
 * Crea un listing (product o service) para el comercio del usuario actual.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { listings, products, services, merchantUsers } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const baseSchema = z.object({
  type: z.enum(["product", "service"]),
  title: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).optional(),
  description: z.string().optional(),
  descriptionEn: z.string().optional(),
  priceCents: z.number().int().positive(),
  currency: z.enum(["MXN", "USD", "EUR"]).default("MXN"),
  images: z.array(z.string().url()).optional(),
  inventoryQty: z.number().int().nonnegative().optional(),
  durationMin: z.number().int().positive().optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(["draft", "live"]).default("live"),
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
  const parsed = baseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  // Validar campos por tipo
  if (data.type === "service" && !data.durationMin) {
    return NextResponse.json({ error: "durationMin required for services" }, { status: 400 });
  }

  try {
    const [listing] = await db
      .insert(listings)
      .values({
        merchantId: link.merchantId,
        type: data.type,
        slug: data.slug ?? slugify(data.title),
        title: data.title,
        description: data.description,
        descriptionEn: data.descriptionEn,
        priceCents: data.priceCents,
        currency: data.currency,
        images: data.images ?? [],
        status: data.status,
      })
      .returning();

    if (!listing) {
      return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
    }

    // Insertar subtype
    if (data.type === "product") {
      await db.insert(products).values({
        listingId: listing.id,
        inventoryQty: data.inventoryQty ?? 0,
      });
    } else {
      await db.insert(services).values({
        listingId: listing.id,
        durationMin: data.durationMin!,
        capacity: data.capacity ?? 1,
      });
    }

    return NextResponse.json({ id: listing.id, slug: listing.slug });
  } catch (err) {
    console.error("[listing-create]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

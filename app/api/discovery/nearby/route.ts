/**
 * GET /api/discovery/nearby?lng=&lat=&radius=&category=
 *
 * Devuelve comercios activos cerca del punto, ordenados por distancia.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { findMerchantsNearby } from "@/lib/geo";

const querySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radius: z.coerce.number().min(100).max(50_000).default(5000), // metros
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.error.issues }, { status: 400 });
  }

  const { lng, lat, radius, category, limit } = parsed.data;

  const merchants = await findMerchantsNearby({
    point: { lng, lat },
    radiusMeters: radius,
    categorySlug: category,
    limit,
  });

  return NextResponse.json({ merchants, center: { lng, lat }, radius });
}

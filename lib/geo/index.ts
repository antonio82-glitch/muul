/**
 * Helpers para queries geográficas con PostGIS.
 * Drizzle no expresa estas funciones bien — usamos sql`` raw.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type GeoPoint = { lng: number; lat: number };

/**
 * Encuentra comercios activos dentro de un radio (metros), ordenados por distancia.
 */
export async function findMerchantsNearby(params: {
  point: GeoPoint;
  radiusMeters: number;
  limit?: number;
  categorySlug?: string;
}) {
  const { point, radiusMeters, limit = 50, categorySlug } = params;

  const result = await db.execute<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    city: string | null;
    distance_m: number;
    lng: number;
    lat: number;
  }>(sql`
    select
      m.id,
      m.slug,
      m.name,
      m.description,
      m.logo_url,
      m.city,
      ST_Distance(
        m.location,
        ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography
      ) as distance_m,
      ST_X(m.location::geometry) as lng,
      ST_Y(m.location::geometry) as lat
    from merchants m
    ${categorySlug ? sql`join categories c on c.id = m.category_id and c.slug = ${categorySlug}` : sql``}
    where m.status = 'active'
      and m.location is not null
      and ST_DWithin(
        m.location,
        ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography,
        ${radiusMeters}
      )
    order by distance_m asc
    limit ${limit};
  `);

  return result;
}

/**
 * Distancia en metros entre dos puntos (Haversine via PostGIS).
 */
export async function distanceBetween(a: GeoPoint, b: GeoPoint): Promise<number> {
  const result = await db.execute<{ d: number }>(sql`
    select ST_Distance(
      ST_SetSRID(ST_MakePoint(${a.lng}, ${a.lat}), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${b.lng}, ${b.lat}), 4326)::geography
    ) as d;
  `);
  return Number(result[0]?.d ?? 0);
}

/**
 * Datos de prueba para desarrollo local.
 * Uso: pnpm db:seed
 */
import "dotenv/config";
import { db } from "./index";
import { categories, pickupPoints } from "./schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("→ Seeding categories...");
  await db.insert(categories).values([
    { slug: "gastronomia", nameEs: "Gastronomía", nameEn: "Food & Drink", iconKey: "utensils", sortOrder: 1 },
    { slug: "tours", nameEs: "Tours y experiencias", nameEn: "Tours & Experiences", iconKey: "compass", sortOrder: 2 },
    { slug: "moda", nameEs: "Moda y autor", nameEn: "Fashion & Design", iconKey: "shirt", sortOrder: 3 },
    { slug: "artesania", nameEs: "Artesanía", nameEn: "Crafts", iconKey: "palette", sortOrder: 4 },
    { slug: "wellness", nameEs: "Wellness y spa", nameEn: "Wellness & Spa", iconKey: "leaf", sortOrder: 5 },
    { slug: "deportes", nameEs: "Deportes acuáticos", nameEn: "Water Sports", iconKey: "waves", sortOrder: 6 },
  ]).onConflictDoNothing();

  console.log("→ Seeding pickup points (Tulum + Playa)...");
  await db.execute(sql`
    insert into pickup_points (name, address, location, hours)
    values
      (
        'Café Múul · Tulum Centro',
        'Av. Tulum 14, Tulum Centro, 77780',
        ST_SetSRID(ST_MakePoint(-87.4654, 20.2114), 4326)::geography,
        '{"mon":[{"open":"08:00","close":"21:00"}],"tue":[{"open":"08:00","close":"21:00"}]}'::jsonb
      ),
      (
        'Punto Múul · Playa 5ta',
        'Av. 5 entre 12 y 14, Playa del Carmen, 77710',
        ST_SetSRID(ST_MakePoint(-87.0739, 20.6296), 4326)::geography,
        '{"mon":[{"open":"09:00","close":"22:00"}]}'::jsonb
      )
    on conflict do nothing;
  `);

  console.log("✓ Seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});

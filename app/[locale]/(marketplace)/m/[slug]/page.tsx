import { db } from "@/lib/db";
import { merchants, listings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";

export default async function MerchantPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const merchant = await db.query.merchants.findFirst({
    where: and(eq(merchants.slug, slug), eq(merchants.status, "active")),
  });
  if (!merchant) notFound();

  const items = await db.query.listings.findMany({
    where: and(eq(listings.merchantId, merchant.id), eq(listings.status, "live")),
    limit: 60,
  });

  return (
    <article>
      {/* Hero del comercio */}
      <section className="bg-tinta text-hueso px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-turquesa mb-6">
            {merchant.city ?? "Riviera Maya"}
          </p>
          <h1 className="display-xl mb-6">{merchant.name}</h1>
          {merchant.description && (
            <p className="font-display italic text-xl max-w-2xl text-hueso/80">
              {merchant.description}
            </p>
          )}
        </div>
      </section>

      {/* Listings */}
      <section className="px-6 py-16 max-w-7xl mx-auto">
        <p className="label mb-3">/ {locale === "es" ? "Catálogo" : "Catalog"}</p>
        <h2 className="display-lg mb-12">
          {items.length} {locale === "es" ? "productos y servicios" : "items"}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((l) => (
            <Link
              key={l.id}
              href={`/${locale}/l/${l.id}`}
              className="border border-tinta/10 rounded-sm overflow-hidden hover:border-coral transition"
            >
              {l.images[0] && (
                <div className="relative aspect-square bg-hueso-2">
                  <Image src={l.images[0]} alt={l.title} fill className="object-cover" />
                </div>
              )}
              <div className="p-4">
                <p className="label text-coral mb-1">
                  {l.type === "service" ? (locale === "es" ? "Servicio" : "Service") : (locale === "es" ? "Producto" : "Product")}
                </p>
                <h3 className="font-display text-lg leading-tight mb-2 line-clamp-2">{l.title}</h3>
                <p className="font-mono text-sm text-turquesa-deep">
                  {formatMoney(l.priceCents, l.currency, locale === "es" ? "es-MX" : "en-US")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}

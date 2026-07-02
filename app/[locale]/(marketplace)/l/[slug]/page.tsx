import { db } from "@/lib/db";
import { listings, merchants, products, services, availabilitySlots } from "@/lib/db/schema";
import { eq, and, gte, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { formatMoney } from "@/lib/utils";
import { ListingActions } from "@/components/marketplace/listing-actions";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  // slug aquí es el listing ID
  const listing = await db.query.listings.findFirst({
    where: and(eq(listings.id, slug), eq(listings.status, "live")),
  });
  if (!listing) notFound();

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, listing.merchantId),
  });
  if (!merchant) notFound();

  // Cargar subtype data
  const product = listing.type === "product"
    ? await db.query.products.findFirst({ where: eq(products.listingId, listing.id) })
    : null;
  const service = listing.type === "service"
    ? await db.query.services.findFirst({ where: eq(services.listingId, listing.id) })
    : null;

  // Slots disponibles (próximos 14 días)
  const slots = service
    ? await db.query.availabilitySlots.findMany({
        where: and(
          eq(availabilitySlots.serviceListingId, listing.id),
          gte(availabilitySlots.startsAt, new Date()),
        ),
        orderBy: [asc(availabilitySlots.startsAt)],
        limit: 60,
      })
    : [];

  return (
    <article className="px-6 py-12 max-w-7xl mx-auto">
      <p className="label mb-3">
        <a href={`/${locale}/m/${merchant.slug}`} className="text-coral hover:underline">
          ← {merchant.name}
        </a>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Galería */}
        <div className="space-y-4">
          {listing.images.length > 0 ? (
            listing.images.map((src, i) => (
              <div key={i} className="relative aspect-square bg-hueso-2 rounded-sm overflow-hidden">
                <Image src={src} alt={`${listing.title} ${i + 1}`} fill className="object-cover" />
              </div>
            ))
          ) : (
            <div className="aspect-square bg-tinta flex items-center justify-center rounded-sm">
              <span className="font-display text-7xl text-coral">{listing.title[0]}</span>
            </div>
          )}
        </div>

        {/* Info + acciones */}
        <div>
          <p className="label text-coral mb-3">
            {listing.type === "service"
              ? locale === "es" ? "Servicio" : "Service"
              : locale === "es" ? "Producto" : "Product"}
          </p>
          <h1 className="display-lg mb-6">{listing.title}</h1>
          <p className="font-display text-3xl text-turquesa-deep mb-8">
            {formatMoney(listing.priceCents, listing.currency, locale === "es" ? "es-MX" : "en-US")}
          </p>

          {listing.description && (
            <div className="prose prose-stone max-w-none mb-8 text-tinta/80 leading-relaxed">
              {listing.description.split("\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}

          {service && (
            <div className="border-t border-tinta/10 pt-6 mb-8 grid grid-cols-3 gap-4">
              <Stat label={locale === "es" ? "Duración" : "Duration"} value={`${service.durationMin} min`} />
              <Stat label={locale === "es" ? "Capacidad" : "Capacity"} value={String(service.capacity)} />
              <Stat
                label={locale === "es" ? "Reserva con" : "Book ahead"}
                value={`${service.advanceHours}h`}
              />
            </div>
          )}

          {product && (
            <div className="border-t border-tinta/10 pt-6 mb-8">
              <p className="label mb-2">{locale === "es" ? "Disponibilidad" : "In stock"}</p>
              <p className="font-display text-xl">
                {product.inventoryQty > 0
                  ? `${product.inventoryQty} ${locale === "es" ? "disponibles" : "available"}`
                  : locale === "es" ? "Agotado" : "Sold out"}
              </p>
            </div>
          )}

          {/* Acciones cliente: comprar / reservar */}
          <ListingActions
            listing={{
              id: listing.id,
              type: listing.type,
              title: listing.title,
              priceCents: listing.priceCents,
              currency: listing.currency,
              merchantId: merchant.id,
              merchantPayoutsEnabled: merchant.stripePayoutsEnabled,
            }}
            slots={slots.map((s) => ({
              id: s.id,
              startsAt: s.startsAt.toISOString(),
              endsAt: s.endsAt.toISOString(),
              capacityRemaining: s.capacityRemaining,
            }))}
            locale={locale as "es" | "en"}
          />
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </div>
  );
}

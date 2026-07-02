import { db } from "@/lib/db";
import { merchants, categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";

export default async function DescubrePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const { category } = await searchParams;

  const list = await db.query.merchants.findMany({
    where: and(
      eq(merchants.status, "active"),
      category
        ? eq(
            merchants.categoryId,
            (await db.query.categories.findFirst({ where: eq(categories.slug, category) }))?.id ?? "",
          )
        : undefined,
    ),
    limit: 60,
  });

  return (
    <section className="px-6 py-16 max-w-7xl mx-auto">
      <p className="label mb-3">/ {locale === "es" ? "Descubre" : "Discover"}</p>
      <h1 className="display-lg mb-12">
        {locale === "es" ? "Comercios" : "Businesses"}
        {category ? <em className="italic text-turquesa-deep"> · {category}</em> : null}
      </h1>

      {list.length === 0 ? (
        <div className="border border-tinta/10 rounded-sm p-12 text-center">
          <p className="font-display italic text-xl text-tinta/60">
            {locale === "es"
              ? "Aún no hay comercios en esta categoría."
              : "No businesses in this category yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {list.map((m) => (
            <Link
              key={m.id}
              href={`/${locale}/m/${m.slug}`}
              className="border border-tinta/10 rounded-sm overflow-hidden hover:border-coral transition group"
            >
              {m.coverUrl ? (
                <div className="relative h-48 bg-hueso-2">
                  <Image src={m.coverUrl} alt={m.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="h-48 bg-tinta flex items-center justify-center">
                  <span className="font-display text-4xl text-coral">
                    {m.name[0]}
                  </span>
                </div>
              )}
              <div className="p-6">
                <h3 className="display-md mb-1">{m.name}</h3>
                {m.city && <p className="label text-coral">{m.city}</p>}
                {m.description && (
                  <p className="mt-3 text-sm text-tinta/70 line-clamp-2">{m.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

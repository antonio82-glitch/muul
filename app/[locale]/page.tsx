import { useTranslations } from "next-intl";
import Link from "next/link";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cats = await db.query.categories.findMany({
    orderBy: [asc(categories.sortOrder)],
  });

  return (
    <>
      {/* Hero */}
      <section className="px-6 py-32 md:py-40 max-w-7xl mx-auto">
        <p className="label mb-6">
          {locale === "es" ? "Riviera Maya · 2026" : "Riviera Maya · 2026"}
        </p>
        <h1 className="display-xl max-w-4xl">
          {locale === "es" ? (
            <>
              Lo local, <em className="not-italic text-turquesa-deep italic">al alcance</em> de un click<span className="text-coral">.</span>
            </>
          ) : (
            <>
              Local life, <em className="not-italic text-turquesa-deep italic">one click</em> away<span className="text-coral">.</span>
            </>
          )}
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-tinta/70 font-display italic font-light">
          {locale === "es"
            ? "Reserva tours, compra arte local, paga en cualquier comercio aliado de la Riviera Maya."
            : "Book tours, buy local art, pay at any partner business across the Riviera Maya."}
        </p>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href={`/${locale}/descubre`}
            className="bg-tinta text-hueso px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition"
          >
            {locale === "es" ? "Explorar comercios" : "Explore businesses"}
          </Link>
          <Link
            href={`/${locale}/onboarding`}
            className="border border-tinta/20 px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:border-coral hover:text-coral transition"
          >
            {locale === "es" ? "Soy un comercio" : "I run a business"}
          </Link>
        </div>
      </section>

      {/* Categorías */}
      <section className="px-6 py-24 max-w-7xl mx-auto border-t border-tinta/10">
        <p className="label mb-3">01</p>
        <h2 className="display-lg mb-16">
          {locale === "es" ? "Por categoría" : "By category"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cats.map((c) => (
            <Link
              key={c.id}
              href={`/${locale}/descubre?category=${c.slug}`}
              className="border border-tinta/10 rounded-sm p-8 hover:border-coral hover:bg-coral-soft transition group"
            >
              <p className="label text-coral mb-4">0{c.sortOrder}</p>
              <h3 className="display-md mb-2 group-hover:italic transition">
                {locale === "es" ? c.nameEs : c.nameEn}
              </h3>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

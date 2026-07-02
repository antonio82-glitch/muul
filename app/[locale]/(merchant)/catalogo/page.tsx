import { db } from "@/lib/db";
import { merchantUsers, listings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/signin?next=/${locale}/catalogo`);

  const link = await db.query.merchantUsers.findFirst({
    where: eq(merchantUsers.userId, user.id),
  });
  if (!link) redirect(`/${locale}/onboarding`);

  const items = await db.query.listings.findMany({
    where: eq(listings.merchantId, link.merchantId),
    orderBy: [desc(listings.createdAt)],
  });

  return (
    <section className="px-6 py-12 max-w-7xl mx-auto">
      <div className="flex items-baseline justify-between mb-12">
        <div>
          <p className="label mb-3">/ {locale === "es" ? "Catálogo" : "Catalog"}</p>
          <h1 className="display-lg">
            {items.length} {locale === "es" ? "listings" : "listings"}
          </h1>
        </div>
        <Link
          href={`/${locale}/catalogo/nuevo`}
          className="bg-tinta text-hueso px-6 py-3 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition"
        >
          + {locale === "es" ? "Nuevo" : "New"}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="border border-tinta/10 rounded-sm p-16 text-center">
          <p className="font-display italic text-2xl text-tinta/50 mb-6">
            {locale === "es"
              ? "Aún no tienes productos ni servicios."
              : "No products or services yet."}
          </p>
          <Link
            href={`/${locale}/catalogo/nuevo`}
            className="bg-coral text-hueso px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:opacity-90 transition inline-block"
          >
            {locale === "es" ? "Crear el primero →" : "Create the first one →"}
          </Link>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-tinta/10">
              <th className="label text-left py-3">{locale === "es" ? "Título" : "Title"}</th>
              <th className="label text-left py-3">{locale === "es" ? "Tipo" : "Type"}</th>
              <th className="label text-right py-3">{locale === "es" ? "Precio" : "Price"}</th>
              <th className="label text-right py-3">{locale === "es" ? "Estado" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-tinta/10 hover:bg-hueso-2 transition">
                <td className="py-4">
                  <Link href={`/${locale}/catalogo/${l.id}`} className="font-display text-lg hover:text-coral">
                    {l.title}
                  </Link>
                </td>
                <td className="py-4 font-mono text-xs uppercase tracking-[0.15em] text-coral">
                  {l.type}
                </td>
                <td className="py-4 text-right font-mono text-sm text-turquesa-deep">
                  {formatMoney(l.priceCents, l.currency, locale === "es" ? "es-MX" : "en-US")}
                </td>
                <td className="py-4 text-right">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded-sm ${
                      l.status === "live"
                        ? "bg-turquesa-soft text-turquesa-deep"
                        : "bg-hueso-2 text-tinta/60"
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

import { ListingForm } from "@/components/merchant/listing-form";

export default async function NuevoListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <section className="px-6 py-12 max-w-2xl mx-auto">
      <p className="label mb-3">/ {locale === "es" ? "Nuevo listing" : "New listing"}</p>
      <h1 className="display-lg mb-12">
        {locale === "es" ? "Carga producto o servicio" : "Add product or service"}
      </h1>
      <ListingForm locale={locale as "es" | "en"} />
    </section>
  );
}

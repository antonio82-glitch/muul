import { db } from "@/lib/db";
import { merchantUsers, merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { renderMerchantPayQr } from "@/lib/qr";
import { TicketScanner } from "@/components/merchant/ticket-scanner";

export default async function CobrosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/signin?next=/${locale}/cobros`);

  const link = await db.query.merchantUsers.findFirst({
    where: eq(merchantUsers.userId, user.id),
  });
  if (!link) redirect(`/${locale}/onboarding`);

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, link.merchantId),
  });
  if (!merchant) redirect(`/${locale}/onboarding`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qrSvg = await renderMerchantPayQr(merchant.slug, `${baseUrl}/${locale}`);

  return (
    <section className="px-6 py-12 max-w-7xl mx-auto">
      <p className="label mb-3">/ {locale === "es" ? "Cobros" : "Charges"}</p>
      <h1 className="display-lg mb-12">
        {locale === "es" ? "Cobra y canjea." : "Charge and redeem."}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* QR Universal */}
        <div className="border border-tinta/10 rounded-sm p-8">
          <p className="label mb-3">01</p>
          <h2 className="display-md mb-4">
            {locale === "es" ? "Tu QR de cobro" : "Your charge QR"}
          </h2>
          <p className="text-tinta/70 mb-6">
            {locale === "es"
              ? "Imprímelo y pégalo en tu local. Cuando un cliente lo escanee, abre tu tienda en Múul listo para pagar."
              : "Print and stick it in your store. When a customer scans, your shop opens in Múul, ready to pay."}
          </p>
          <div
            className="bg-hueso-2 p-8 rounded-sm flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="font-mono text-[10px] text-tinta/40 mt-4 text-center break-all">
            {baseUrl}/{locale}/m/{merchant.slug}
          </p>
        </div>

        {/* Scanner */}
        <div className="border border-tinta/10 rounded-sm p-8">
          <p className="label mb-3">02</p>
          <h2 className="display-md mb-4">
            {locale === "es" ? "Canjear pase" : "Redeem pass"}
          </h2>
          <p className="text-tinta/70 mb-6">
            {locale === "es"
              ? "Escanea el QR del cliente o pega el código manualmente para liberar el pago."
              : "Scan the customer's QR or paste the code to release the payment."}
          </p>
          <TicketScanner locale={locale as "es" | "en"} />
        </div>
      </div>
    </section>
  );
}

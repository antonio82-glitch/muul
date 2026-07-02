import Link from "next/link";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function OnboardingDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const { locale } = await params;
  const { account } = await searchParams;

  let payoutsEnabled = false;
  let needsMore = true;

  if (account) {
    try {
      const stripeAccount = await stripe.accounts.retrieve(account);
      payoutsEnabled = stripeAccount.payouts_enabled ?? false;
      needsMore = !stripeAccount.details_submitted;

      // Sync con DB (el webhook account.updated también lo hace, pero por si llega tarde)
      await db
        .update(merchants)
        .set({
          stripeOnboarded: stripeAccount.details_submitted ?? false,
          stripePayoutsEnabled: payoutsEnabled,
          status: payoutsEnabled ? "active" : "kyc_required",
        })
        .where(eq(merchants.stripeAccountId, account));
    } catch (err) {
      console.error("[onboarding-done] retrieve failed", err);
    }
  }

  return (
    <section className="px-6 py-32 max-w-2xl mx-auto">
      {payoutsEnabled ? (
        <>
          <p className="label text-turquesa-deep mb-3">
            {locale === "es" ? "✓ Verificación completa" : "✓ Verification complete"}
          </p>
          <h1 className="display-lg mb-6">
            {locale === "es" ? "Tu comercio está listo." : "Your business is ready."}
          </h1>
          <p className="text-tinta/70 mb-12 text-lg">
            {locale === "es"
              ? "Ya puedes recibir pagos. El siguiente paso es cargar tu primer producto o servicio."
              : "You can now accept payments. Next step: upload your first product or service."}
          </p>
          <Link
            href={`/${locale}/dashboard`}
            className="bg-tinta text-hueso px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:bg-tinta-2 transition inline-block"
          >
            {locale === "es" ? "Ir al panel →" : "Go to dashboard →"}
          </Link>
        </>
      ) : (
        <>
          <p className="label text-coral mb-3">
            {locale === "es" ? "Verificación pendiente" : "Verification pending"}
          </p>
          <h1 className="display-lg mb-6">
            {locale === "es" ? "Falta un poco." : "Almost there."}
          </h1>
          <p className="text-tinta/70 mb-12 text-lg">
            {locale === "es"
              ? "Stripe necesita más información para activar tus pagos. Vuelve cuando esté listo o regresa al onboarding."
              : "Stripe needs more info to enable payouts. Come back later or restart the onboarding."}
          </p>
          <Link
            href={`/${locale}/onboarding`}
            className="border border-tinta/20 px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:border-coral hover:text-coral transition inline-block"
          >
            {locale === "es" ? "Reintentar verificación" : "Retry verification"}
          </Link>
        </>
      )}
    </section>
  );
}

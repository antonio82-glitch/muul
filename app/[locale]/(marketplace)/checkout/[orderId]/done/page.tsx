import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CheckoutDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}) {
  const { locale, orderId } = await params;
  const { redirect_status } = await searchParams;

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) notFound();

  const succeeded = redirect_status === "succeeded" || order.status === "paid";

  return (
    <section className="px-6 py-32 max-w-2xl mx-auto text-center">
      {succeeded ? (
        <>
          <p className="label text-turquesa-deep mb-3">
            {locale === "es" ? "✓ Pago confirmado" : "✓ Payment confirmed"}
          </p>
          <h1 className="display-lg mb-6">
            {locale === "es" ? "¡Listo!" : "All set!"}
          </h1>
          <p className="text-tinta/70 mb-12 text-lg">
            {locale === "es"
              ? "Te enviamos un correo con tu pase digital y los detalles."
              : "We've sent you an email with your digital pass and details."}
          </p>
          <p className="font-mono text-xs text-tinta/50 mb-12">
            {locale === "es" ? "Pedido" : "Order"} #{order.id.slice(0, 8)}
          </p>
          <Link
            href={`/${locale}`}
            className="border border-tinta/20 px-8 py-4 rounded-sm font-mono text-xs uppercase tracking-[0.2em] hover:border-coral hover:text-coral transition inline-block"
          >
            {locale === "es" ? "← Volver" : "← Back home"}
          </Link>
        </>
      ) : (
        <>
          <p className="label text-coral mb-3">
            {locale === "es" ? "Pago en proceso" : "Payment processing"}
          </p>
          <h1 className="display-lg mb-6">
            {locale === "es" ? "Aún procesando…" : "Still processing…"}
          </h1>
          <p className="text-tinta/70 mb-12 text-lg">
            {locale === "es"
              ? "Te avisaremos por correo cuando se confirme. Esto puede tardar hasta unos minutos en métodos como OXXO."
              : "We'll email you once it's confirmed. Some methods like OXXO can take a few minutes."}
          </p>
        </>
      )}
    </section>
  );
}

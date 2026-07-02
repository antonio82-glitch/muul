import { db } from "@/lib/db";
import { orders, orderItems, merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/marketplace/checkout-form";
import { formatMoney } from "@/lib/utils";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const { locale, orderId } = await params;

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order) notFound();

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, order.merchantId),
  });
  if (!merchant) notFound();

  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, order.id),
  });

  const formatLocale = locale === "es" ? "es-MX" : "en-US";

  return (
    <section className="px-6 py-16 max-w-5xl mx-auto">
      <p className="label mb-3">/ Checkout</p>
      <h1 className="display-lg mb-12">
        {locale === "es" ? "Finalizar compra" : "Complete your purchase"}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Resumen */}
        <aside className="border border-tinta/10 rounded-sm p-8 h-fit">
          <p className="label mb-6">
            {locale === "es" ? "Pedido en" : "Order at"} {merchant.name}
          </p>
          <ul className="space-y-3 mb-6">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4">
                <span className="text-sm">
                  {i.qty}× {i.titleSnapshot}
                </span>
                <span className="font-mono text-sm text-turquesa-deep whitespace-nowrap">
                  {formatMoney(i.unitPriceCents * i.qty, order.currency, formatLocale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-tinta/10 pt-4 flex justify-between font-display text-xl">
            <span>Total</span>
            <span className="text-coral">
              {formatMoney(order.totalCents, order.currency, formatLocale)}
            </span>
          </div>
          <p className="font-mono text-[10px] text-tinta/50 mt-6 leading-relaxed">
            {locale === "es"
              ? "Pago protegido. El comercio recibe los fondos cuando confirmas la entrega o canjeas tu pase."
              : "Protected payment. The business receives funds once you confirm delivery or redeem your pass."}
          </p>
        </aside>

        {/* Stripe Payment Element */}
        <div>
          <CheckoutForm orderId={order.id} locale={locale as "es" | "en"} />
        </div>
      </div>
    </section>
  );
}

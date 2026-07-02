import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { merchantUsers, merchants, orders } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/utils";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/signin`);

  // Cargar primer comercio del usuario
  const link = await db.query.merchantUsers.findFirst({
    where: eq(merchantUsers.userId, user.id),
  });
  if (!link) redirect(`/${locale}/onboarding`);

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, link.merchantId),
  });
  if (!merchant) redirect(`/${locale}/onboarding`);

  // KPIs del día
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayOrders = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${orders.subtotalCents}), 0)::bigint`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchant.id),
        eq(orders.status, "paid"),
        gte(orders.createdAt, todayStart),
      ),
    );

  const stats = todayOrders[0];

  return (
    <section className="px-6 py-12 max-w-7xl mx-auto">
      <p className="label mb-3">/ {merchant.name}</p>
      <h1 className="display-lg mb-12">
        {locale === "es" ? "Panel" : "Dashboard"}
      </h1>

      {merchant.status !== "active" && (
        <div className="border-l-2 border-coral pl-6 py-4 mb-12 bg-coral-soft rounded-sm">
          <p className="label text-coral mb-2">
            {locale === "es" ? "Acción requerida" : "Action required"}
          </p>
          <p>
            {locale === "es"
              ? "Tu cuenta Stripe aún no está lista para recibir pagos. Completa la verificación."
              : "Your Stripe account isn't ready to receive payments yet. Complete verification."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Stat
          label={locale === "es" ? "Ventas hoy" : "Today's sales"}
          value={formatMoney(Number(stats?.total ?? 0), "MXN", locale === "es" ? "es-MX" : "en-US")}
        />
        <Stat
          label={locale === "es" ? "Pedidos hoy" : "Orders today"}
          value={String(stats?.count ?? 0)}
        />
        <Stat
          label={locale === "es" ? "Comisión Múul" : "Múul fee"}
          value={`${(Number(merchant.commissionPct) * 100).toFixed(1)}%`}
        />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-tinta/10 rounded-sm p-8">
      <p className="label mb-3">{label}</p>
      <p className="display-md">{value}</p>
    </div>
  );
}

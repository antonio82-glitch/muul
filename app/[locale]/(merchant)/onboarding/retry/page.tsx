import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { merchantUsers, merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOnboardingLink } from "@/lib/stripe/connect";

/**
 * Stripe redirige aquí si el link de KYC expiró.
 * Genera un nuevo link y redirige a Stripe.
 */
export default async function OnboardingRetryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/signin?next=/${locale}/onboarding`);

  const link = await db.query.merchantUsers.findFirst({
    where: eq(merchantUsers.userId, user.id),
  });
  if (!link) redirect(`/${locale}/onboarding`);

  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, link.merchantId),
  });
  if (!merchant?.stripeAccountId) redirect(`/${locale}/onboarding`);

  const newLink = await createOnboardingLink(merchant.stripeAccountId);
  redirect(newLink.url);
}

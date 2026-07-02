/**
 * Wrapper de Resend para emails transaccionales.
 * Logueamos cada envío en la tabla `notifications`.
 */
import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? "Múul <hola@muul.mx>";

export type EmailTemplate = "order_confirmed" | "booking_reminder" | "payout_sent" | "merchant_welcome";

export async function sendEmail(params: {
  to: string;
  userId?: string;
  template: EmailTemplate;
  subject: string;
  html: string;
  payload?: Record<string, unknown>;
}) {
  // Log antes de enviar
  const [notif] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      channel: "email",
      template: params.template,
      payload: params.payload ?? {},
    })
    .returning();

  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send");
    return { skipped: true };
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (result.error) {
      await db
        .update(notifications)
        .set({ failedAt: new Date(), errorMessage: result.error.message })
        .where(eq(notifications.id, notif!.id));
      return { error: result.error };
    }

    await db
      .update(notifications)
      .set({ sentAt: new Date() })
      .where(eq(notifications.id, notif!.id));

    return { id: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await db
      .update(notifications)
      .set({ failedAt: new Date(), errorMessage: msg })
      .where(eq(notifications.id, notif!.id));
    return { error: err };
  }
}

/**
 * Template HTML del email "orden confirmada".
 * Usa inline styles para máxima compatibilidad con clientes de email.
 */
import { formatMoney } from "@/lib/utils";

export function orderConfirmedEmail(params: {
  customerName?: string | null;
  merchantName: string;
  orderId: string;
  totalCents: number;
  currency: "MXN" | "USD" | "EUR";
  items: Array<{ title: string; qty: number; lineCents: number }>;
  qrToken?: string;
  appUrl: string;
  locale?: "es" | "en";
}): { subject: string; html: string } {
  const isEs = (params.locale ?? "es") === "es";
  const formatLocale = isEs ? "es-MX" : "en-US";

  const subject = isEs
    ? `Tu pedido en ${params.merchantName} está confirmado`
    : `Your order at ${params.merchantName} is confirmed`;

  const itemsHtml = params.items
    .map(
      (i) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #ECE5D6;font-family:'DM Sans',sans-serif;color:#0A0E1A;">
        ${i.qty}× ${escapeHtml(i.title)}
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #ECE5D6;font-family:'JetBrains Mono',monospace;color:#0E8478;text-align:right;">
        ${formatMoney(i.lineCents, params.currency, formatLocale)}
      </td>
    </tr>`,
    )
    .join("");

  const ticketHtml = params.qrToken
    ? `
    <div style="margin:32px 0;padding:24px;background:#0A0E1A;border-radius:4px;text-align:center;">
      <p style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.2em;color:#1AB6A8;text-transform:uppercase;margin:0 0 12px;">
        ${isEs ? "Tu pase digital" : "Your digital pass"}
      </p>
      <p style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#F4EFE6;margin:0 0 16px;word-break:break-all;">
        ${params.qrToken}
      </p>
      <a href="${params.appUrl}/tickets/${params.qrToken}" style="display:inline-block;background:#FF6B47;color:#F4EFE6;padding:12px 24px;border-radius:4px;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">
        ${isEs ? "Ver mi QR" : "View my QR"}
      </a>
    </div>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#0A0E1A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4EFE6;padding:48px 24px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:4px;overflow:hidden;">
        <tr><td style="padding:48px 40px;">

          <p style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.2em;color:#FF6B47;text-transform:uppercase;margin:0 0 16px;">
            ${isEs ? "Pedido confirmado" : "Order confirmed"}
          </p>

          <h1 style="font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:36px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 24px;color:#0A0E1A;">
            ${isEs ? "Gracias" : "Thanks"}${params.customerName ? `, ${escapeHtml(params.customerName)}` : ""}.
          </h1>

          <p style="font-size:16px;line-height:1.6;margin:0 0 32px;color:#0A0E1A;">
            ${isEs
              ? `Tu pedido en <strong>${escapeHtml(params.merchantName)}</strong> está confirmado. El comercio recibirá los fondos cuando confirmes la entrega o canjees tu pase.`
              : `Your order at <strong>${escapeHtml(params.merchantName)}</strong> is confirmed. The business receives funds once you confirm delivery or redeem your pass.`}
          </p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:32px 0;">
            ${itemsHtml}
            <tr>
              <td style="padding:16px 0;font-family:'Fraunces',serif;font-size:18px;font-weight:500;color:#0A0E1A;">
                Total
              </td>
              <td style="padding:16px 0;font-family:'JetBrains Mono',monospace;font-size:18px;color:#FF6B47;text-align:right;font-weight:500;">
                ${formatMoney(params.totalCents, params.currency, formatLocale)}
              </td>
            </tr>
          </table>

          ${ticketHtml}

          <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#8A8A85;margin:32px 0 0;letter-spacing:0.05em;">
            ${isEs ? "Pedido" : "Order"} #${params.orderId.slice(0, 8)}
          </p>

        </td></tr>
      </table>

      <p style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.3em;color:#8A8A85;text-transform:uppercase;margin:32px 0 0;">
        Múul · Riviera Maya
      </p>

    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

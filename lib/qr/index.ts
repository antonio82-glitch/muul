/**
 * Generación y verificación de QR tokens para tickets de servicio.
 *
 * Un ticket se canjea cuando el comercio escanea el QR del cliente.
 * El token es opaco (no contiene datos sensibles), apunta a un booking.
 */
import { randomBytes, createHmac } from "node:crypto";
import QRCode from "qrcode";

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-secret-change-me";

/**
 * Genera un token único con firma HMAC para verificar integridad.
 * Formato: `<32 bytes random base64url>.<8 bytes hmac base64url>`
 */
export function generateQrToken(): string {
  const random = randomBytes(24).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(random).digest("base64url").slice(0, 12);
  return `${random}.${sig}`;
}

export function verifyQrToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [random, sig] = parts;
  if (!random || !sig) return false;
  const expected = createHmac("sha256", SECRET).update(random).digest("base64url").slice(0, 12);
  return expected === sig;
}

/**
 * Genera un SVG nítido del QR. Usado en pantalla y en email.
 */
export async function renderQrSvg(token: string): Promise<string> {
  return QRCode.toString(token, {
    type: "svg",
    margin: 1,
    width: 320,
    color: {
      dark: "#0A0E1A",
      light: "#F4EFE6",
    },
    errorCorrectionLevel: "M",
  });
}

/**
 * QR universal de cobro presencial para un comercio.
 * El QR apunta a `/m/{slug}/pay` que abre checkout con monto editable.
 */
export async function renderMerchantPayQr(merchantSlug: string, baseUrl: string): Promise<string> {
  const url = `${baseUrl}/m/${merchantSlug}/pay`;
  return QRCode.toString(url, {
    type: "svg",
    margin: 2,
    width: 480,
    color: { dark: "#0A0E1A", light: "#F4EFE6" },
  });
}

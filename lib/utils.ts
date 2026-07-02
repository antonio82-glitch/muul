import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convierte texto a slug URL-safe.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Formatea cents a moneda local. NUNCA hagas math con floats de dinero;
 * todo se almacena en cents (bigint) y se formatea aquí.
 */
export function formatMoney(
  cents: number,
  currency: "MXN" | "USD" | "EUR" = "MXN",
  locale: "es-MX" | "en-US" = "es-MX",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Formato corto de distancia.
 */
export function formatDistance(meters: number, locale: "es" | "en" = "es"): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

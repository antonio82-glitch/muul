import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "./lib/i18n/config";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export async function middleware(request: NextRequest) {
  // 1. Refrescar sesión de Supabase (importante: antes de cualquier otra cosa)
  const { user } = await updateSession(request);

  // 2. Aplicar i18n routing
  const intlResponse = intlMiddleware(request);

  // 3. Inyectar geo headers de Vercel para que server components los lean
  const country = request.headers.get("x-vercel-ip-country") ?? "MX";
  const city = request.headers.get("x-vercel-ip-city") ?? "";
  intlResponse.headers.set("x-muul-country", country);
  intlResponse.headers.set("x-muul-city", city);

  // 4. Proteger rutas /merchant/*
  const path = request.nextUrl.pathname;
  const isMerchantRoute = /^\/(es|en)\/(dashboard|catalogo|reservas|cobros|payouts)/.test(path);
  if (isMerchantRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${path.split("/")[1] ?? "es"}/signin`;
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|auth|.*\\..*).*)"],
};

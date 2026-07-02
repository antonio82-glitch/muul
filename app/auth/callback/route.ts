/**
 * GET /auth/callback?code=...&next=...
 *
 * El magic link de Supabase redirige aquí. Intercambiamos el código
 * por una sesión, seteamos la cookie y redirigimos a `next`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth-callback] exchange failed", error);
  }

  return NextResponse.redirect(`${origin}/es/signin?error=callback`);
}

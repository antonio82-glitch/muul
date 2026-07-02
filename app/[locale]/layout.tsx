import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";
import { Wordmark } from "@/components/brand/wordmark";
import Link from "next/link";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <header className="border-b border-tinta/10">
            <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
              <Link href={`/${locale}`} className="flex items-center gap-2">
                <Wordmark className="h-7" />
              </Link>
              <nav className="flex items-center gap-6 font-mono text-xs uppercase tracking-[0.15em]">
                <Link href={`/${locale}/descubre`} className="hover:text-coral transition">
                  {locale === "es" ? "Descubre" : "Discover"}
                </Link>
                <Link href={`/${locale}/dashboard`} className="hidden md:inline hover:text-coral transition">
                  {locale === "es" ? "Panel" : "Dashboard"}
                </Link>
                <Link href={`/${locale}/signin`} className="hover:text-coral transition">
                  {locale === "es" ? "Entrar" : "Sign in"}
                </Link>
                <LocaleSwitcher current={locale as Locale} />
              </nav>
            </div>
          </header>

          <main className="min-h-[calc(100vh-200px)]">{children}</main>

          <footer className="border-t border-tinta/10 mt-32">
            <div className="mx-auto max-w-7xl px-6 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <Wordmark className="h-9 text-tinta" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-tinta/40">
                Múul · Riviera Maya · 2026
              </p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function LocaleSwitcher({ current }: { current: Locale }) {
  const other: Locale = current === "es" ? "en" : "es";
  return (
    <Link href={`/${other}`} className="text-tinta/60 hover:text-coral transition">
      {other.toUpperCase()}
    </Link>
  );
}

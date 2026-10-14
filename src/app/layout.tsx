import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dirFor, isLocale, DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

// A calm grotesque with a matching Arabic companion. Latin glyphs always come
// from Plex Sans; Arabic glyphs fall through to Plex Sans Arabic.
const plex = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Ledger", template: "%s · Ledger" },
  description: "A calm personal debit & credit dashboard.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, headerStore, rawLocale] = await Promise.all([getCurrentUser(), headers(), getLocale()]);
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const theme = user?.settings.theme ?? "system";
  // The proxy issues a per-request nonce; the CSP only allows inline scripts that carry it.
  const nonce = headerStore.get("x-nonce") ?? undefined;
  const bootScript = `(function(){try{var t=${JSON.stringify(theme)};var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      suppressHydrationWarning
      className={`${plex.variable} ${plexArabic.variable} h-full ${theme === "dark" ? "dark" : ""}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <ThemeProvider initial={theme}>
            {children}
            <Toaster
              position={dirFor(locale) === "rtl" ? "bottom-left" : "bottom-right"}
              dir={dirFor(locale)}
              toastOptions={{
                className: "!rounded-xl !border-line !bg-surface !text-ink !shadow-pop !text-[13px] !font-sans",
              }}
            />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

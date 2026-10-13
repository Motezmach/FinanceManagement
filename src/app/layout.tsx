import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });

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
  const [user, headerStore] = await Promise.all([getCurrentUser(), headers()]);
  const theme = user?.settings.theme ?? "system";
  // The proxy issues a per-request nonce; the CSP only allows inline scripts that carry it.
  const nonce = headerStore.get("x-nonce") ?? undefined;
  const bootScript = `(function(){try{var t=${JSON.stringify(theme)};var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${display.variable} h-full ${theme === "dark" ? "dark" : ""}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider initial={theme}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "!rounded-xl !border-line !bg-surface !text-ink !shadow-pop !text-[13px]",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

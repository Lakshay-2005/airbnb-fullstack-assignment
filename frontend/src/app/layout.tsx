import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { AppProvider } from "@/context/AppProvider";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { ToastProvider } from "@/components/ui/Toast";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "An independent educational Airbnb clone: discover villas, cabins, apartments and boutique stays, search by destination, dates and guests, then book in minutes.";

export const metadata: Metadata = {
  // Fixed on purpose: every route shows exactly "Airbnb Clone" in the tab (no per-page templates).
  title: "Airbnb Clone",
  description: DESCRIPTION,
  applicationName: "Airbnb Clone",
  openGraph: {
    type: "website",
    siteName: "Airbnb Clone",
    title: "Airbnb Clone",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Airbnb Clone",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>
          <AppProvider>
            <Header />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
            <MobileTabBar />
          </AppProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

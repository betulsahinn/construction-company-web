import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { BRAND_NAME } from "@/lib/i18n";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_SEO,
  LOGO_IMAGE,
  SITE_URL,
  absoluteUrl,
  createGlobalStructuredData,
} from "@/lib/seo";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_SEO.title,
    template: `%s | ${BRAND_NAME}`,
  },
  description: DEFAULT_SEO.description,
  applicationName: BRAND_NAME,
  category: "Interior architecture and design studio",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: LOGO_IMAGE, type: "image/png" },
    ],
    apple: [{ url: LOGO_IMAGE, type: "image/png" }],
  },
  openGraph: {
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description,
    url: absoluteUrl("/"),
    siteName: BRAND_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE),
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} interior architecture portfolio`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = createGlobalStructuredData();

  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="min-h-screen">
        {structuredData.map((item) => (
          <JsonLd key={item["@id"] ?? item["@type"]} data={item} />
        ))}
        {children}
      </body>
    </html>
  );
}

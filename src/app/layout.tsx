import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-KRC96G4ZS8";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://campaignscan.nl"),
  title: {
    default: "CampaignScan - Google Ads-accountscan",
    template: "%s | CampaignScan"
  },
  description: "Upload je Google Ads-exports en ontvang een duidelijk rapport met verbeterpunten voor je account of webshopproducten.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  },
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "CampaignScan - Google Ads-accountscan",
    description: "Upload je Google Ads-exports en ontvang een duidelijk rapport met verbeterpunten.",
    url: "/",
    siteName: "CampaignScan",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaMeasurementId}');
          `}
        </Script>
        {children}
        <footer className="border-t border-line bg-white px-6 py-5 text-center text-sm text-gray-500">
          <span>CampaignScan is een project van </span>
          <a href="https://www.adsvantage.nl/" className="font-semibold text-ink hover:underline">
            Adsvantage
          </a>
          <span className="mx-2">.</span>
          <a href="/privacy" className="font-semibold text-ink hover:underline">
            Privacyuitleg
          </a>
        </footer>
      </body>
    </html>
  );
}

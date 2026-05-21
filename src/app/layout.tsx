import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-KRC96G4ZS8";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://campaignscan.nl"),
  title: {
    default: "CampaignScan",
    template: "%s | CampaignScan"
  },
  description: "Upload PPC exports and generate practical Google Ads audit reports.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  },
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "CampaignScan",
    description: "Upload PPC exports and generate practical Google Ads audit reports.",
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
    <html lang="en">
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
          CampaignScan is een project van{" "}
          <a href="https://www.adsvantage.nl/" className="font-semibold text-ink hover:underline">
            Adsvantage
          </a>
          .
        </footer>
      </body>
    </html>
  );
}

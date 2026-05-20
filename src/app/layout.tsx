import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://campaignscan.nl"),
  title: {
    default: "CampaignScan",
    template: "%s | CampaignScan"
  },
  description: "Upload PPC exports and generate practical Google Ads audit reports.",
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
      <body>{children}</body>
    </html>
  );
}

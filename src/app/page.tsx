import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ArrowRight, CheckCircle2, ShoppingBag } from "lucide-react";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        <Logo size="sm" />

        <div className="mt-12 max-w-3xl">
          <h1 className="text-5xl font-semibold tracking-tight text-ink">Controleer je Google Ads-account in enkele stappen</h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">
            Upload je exports en ontvang een duidelijk rapport met verbeterpunten. Heb je een webshop? Maak dan ook een
            productbestand waarmee je Shopping- en Performance Max-campagnes slimmer kunt indelen.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/audits/new" className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
              Start mijn scan
              <ArrowRight size={16} />
            </Link>
            <a href="/samples/google_ads_campaigns.csv" className="inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 text-sm font-semibold text-ink hover:bg-mist">
              Bekijk voorbeeldbestand
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Geen ingewikkelde koppeling nodig. Je houdt zelf controle over de bestanden die je uploadt.
          </p>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <section>
            <h2 className="text-2xl font-semibold text-ink">Zo werkt het</h2>
            <ol className="mt-5 space-y-4 text-gray-700">
              {[
                "Kies wat je wilt controleren.",
                "Upload je exports uit Google Ads.",
                "Download je rapport en verbeterplan."
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-lg border border-line bg-mist p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-md bg-white p-2 text-ink">
                <ShoppingBag size={22} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-ink">Voor webshops</h2>
                <p className="mt-3 leading-7 text-gray-600">
                  Maak een aanvullend productbestand met labels voor bijvoorbeeld sterke producten, groeikansen en producten
                  die eerst meer data nodig hebben.
                </p>
                <Link href="/audits/new?route=labelizer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink hover:underline">
                  Maak een productlabelizer
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-4 text-sm text-gray-500">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            CSV, TSV en XLSX
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            Duidelijke uitleg bij ontbrekende data
          </span>
          <Link href="/privacy" className="font-semibold text-ink hover:underline">
            Lees hoe uploads worden verwerkt
          </Link>
        </div>
      </section>
    </main>
  );
}

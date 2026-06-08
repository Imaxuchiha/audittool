import Link from "next/link";

export const metadata = {
  title: "Privacyuitleg",
  description: "Korte uitleg over hoe CampaignScan uploads en contactgegevens verwerkt."
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm font-semibold text-gray-600 hover:text-ink">
          Terug naar CampaignScan
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight text-ink">Privacyuitleg</h1>
        <p className="mt-5 leading-7 text-gray-600">
          CampaignScan verwerkt alleen de bestanden die je zelf uploadt. De app gebruikt deze gegevens om een Google
          Ads-accountscan, productlabelizer of beide te maken.
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-ink">Welke gegevens worden verwerkt?</h2>
          <p className="leading-7 text-gray-600">
            Je kunt Google Ads-, GA4-, Search Console-, productfeed- en websitenotitiebestanden uploaden. Daarnaast vragen
            we om je e-mailadres, bedrijfsnaam en website zodat Adsvantage het rapport kan toesturen en eventueel contact
            kan opnemen over de scan.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-ink">Hoe lang bestaan uploads?</h2>
          <p className="leading-7 text-gray-600">
            De applicatie schrijft uploads niet weg naar een publieke map, database of vaste opslaglocatie. Bestanden worden
            in de aanvraag verwerkt en daarna als rapport of download teruggegeven. Hostingproviders kunnen wel technische
            logs bewaren, zoals foutcodes, timing, IP-adres of requestmetadata. CampaignScan logt bewust geen volledige CSV-
            inhoud, websitenotities of rapportteksten.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-ink">Leadgegevens</h2>
          <p className="leading-7 text-gray-600">
            Als je toestemming geeft, wordt je e-mailadres samen met beperkte formuliergegevens opgeslagen als lead voor
            Adsvantage. Op Netlify gebeurt dit via Netlify Forms. Wanneer e-mailverzending is ingeschakeld, ontvangt de
            gebruiker het rapport per mail en ontvangt Adsvantage een melding.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-ink">Vragen of verwijderen?</h2>
          <p className="leading-7 text-gray-600">
            Wil je weten welke contactgegevens zijn opgeslagen of wil je ze laten verwijderen? Mail naar{" "}
            <a href="mailto:info@adsvantage.nl" className="font-semibold text-ink hover:underline">
              info@adsvantage.nl
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}

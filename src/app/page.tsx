import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck, Upload } from "lucide-react";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Internal PPC tool</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">CampaignScan</h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">
            Upload Google Ads, GA4, Search Console, product feeds, and website notes. Generate a practical agency-style audit report and labeled product feed without connecting Google OAuth in v1.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/audits/new" className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
              Create new audit
              <ArrowRight size={16} />
            </Link>
            <a href="/samples/google_ads_campaigns.csv" className="inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 text-sm font-semibold text-ink hover:bg-mist">
              View sample CSV
            </a>
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ["File-first v1", "No OAuth, no permanent storage. Upload exports and generate the report in one request.", Upload],
            ["Strategist tone", "Commercial explanations, honest data caveats, and practical next steps.", FileText],
            ["Future-ready", "Integration placeholders are ready for Google Ads API, GA4, and Search Console.", ShieldCheck]
          ].map(([title, body, Icon]) => (
            <div key={String(title)} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <Icon className="text-ink" size={22} />
              <h2 className="mt-4 font-semibold text-ink">{title as string}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{body as string}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

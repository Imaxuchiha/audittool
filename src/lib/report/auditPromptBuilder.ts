import { AuditInput, AuditReport, MetricRow, Painpoint, PerformanceComparison, PriorityAction, ProductLabelSummary } from "@/lib/types/audit";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function metricLine(comparison: PerformanceComparison): string {
  const { current, deltaPercent } = comparison;
  return `${money(current.spend)} spend, ${current.clicks.toFixed(0)} clicks, ${percent(current.ctr)} CTR, ${current.conversions.toFixed(1)} conversions, ${money(current.cpa)} CPA and ${current.roas.toFixed(1)} ROAS. Spend moved ${percent(deltaPercent.spend)}, conversions ${percent(deltaPercent.conversions)} and ROAS ${percent(deltaPercent.roas)} versus the comparison period.`;
}

function campaignName(row: MetricRow): string {
  return row.campaign || row.campaignType || "Unnamed campaign";
}

function sentenceList(items: string[]): string {
  return items.filter(Boolean).join(" ");
}

export function buildAuditReport(
  input: AuditInput,
  comparison: PerformanceComparison,
  painpoints: Painpoint[],
  actions: PriorityAction[],
  searchTerms: MetricRow[],
  changeRows: MetricRow[],
  websiteNotes: string,
  productLabelSummary?: ProductLabelSummary
): AuditReport {
  const languageHint =
    input.language === "nl"
      ? "Dit rapport is in het Nederlands geschreven, met een directe PPC-strategietoon."
      : "This report is written in English, with a direct PPC strategist tone.";

  const topCampaigns = comparison.topCampaigns
    .slice(0, 3)
    .map((row) => `${campaignName(row)} (${money(row.spend)} spend, ${row.conversions.toFixed(1)} conversions, ${row.roas.toFixed(1)} ROAS)`);
  const weakCampaigns = comparison.weakCampaigns
    .slice(0, 3)
    .map((row) => `${campaignName(row)} (${money(row.spend)} spend, ${row.conversions.toFixed(1)} conversions)`);

  const highIntentTerms = searchTerms
    .filter((row) => row.conversions > 0 || row.conversionRate > 0.03)
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 6)
    .map((row) => row.searchTerm || row.keyword)
    .filter(Boolean) as string[];

  const wastedTerms = searchTerms
    .filter((row) => row.spend > 10 && row.conversions === 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6)
    .map((row) => row.searchTerm || row.keyword)
    .filter(Boolean) as string[];

  const topPainpoints = painpoints.slice(0, 4);
  const productLabelNotes =
    productLabelSummary && productLabelSummary.totalProducts
      ? [
          `Product source uploaded: ${productLabelSummary.totalProducts} products were parsed and ${productLabelSummary.labeledProducts} products received custom labels.`,
          productLabelSummary.notes.length
            ? `Labelizer notes: ${productLabelSummary.notes.join(" ")}`
            : "The product source was labeled by price bucket, margin bucket, category, stock status and scale priority."
        ]
      : [];

  if (input.language === "nl") {
    return {
      title: `${input.clientName} Google Ads Audit`,
      generatedAt: new Date().toISOString(),
      comparison,
      painpoints,
      executiveSummary: [
        "Dit rapport is geschreven in een directe PPC-strategietoon, met focus op commerciële impact in plaats van losse kanaalstatistieken.",
        `Voor ${input.clientName} is het huidige beeld: ${metricLine(comparison)}`,
        topPainpoints.length
          ? `De belangrijkste blokkades zijn ${topPainpoints.map((item) => item.title.toLowerCase()).join(", ")}. Dit zijn de punten die waarschijnlijk het meeste effect hebben op winst, leadkwaliteit of schaalbaarheid.`
          : "De geüploade data laat geen duidelijke alarmsituatie zien. Verrijk de audit met zoektermen, conversiedata en landingspagina-notities om de aanbevelingen scherper te maken.",
        input.strategistNotes ? `Strategische notitie: ${input.strategistNotes}` : "Er zijn geen strategische notities toegevoegd, dus het rapport leunt volledig op de geüploade exports."
      ],
      performanceNarrative: [
        `Huidige periode: ${input.currentPeriod || "niet opgegeven"}. Vergelijkingsperiode: ${input.previousPeriod || "niet opgegeven"}.`,
        `Het account haalde ${comparison.current.clicks.toFixed(0)} klikken uit ${comparison.current.impressions.toFixed(0)} vertoningen, met ${percent(comparison.current.ctr)} CTR. De gemiddelde CPC is ${money(comparison.current.avgCpc)} en de conversieratio is ${percent(comparison.current.conversionRate)}.`,
        comparison.previous.spend
          ? `Ten opzichte van de vorige periode veranderde spend met ${percent(comparison.deltaPercent.spend)}, conversies met ${percent(comparison.deltaPercent.conversions)}, CPA met ${percent(comparison.deltaPercent.cpa)} en ROAS met ${percent(comparison.deltaPercent.roas)}. De commerciële vraag is of extra budget betere vraag koopt, of vooral meer volume zonder betere kwaliteit.`
          : "Er zijn geen vorige-periode rijen herkend. Lees dit daarom als een huidige-status audit, niet als volledige periode-op-periode diagnose."
      ],
      campaignBudgetAnalysis: [
        topCampaigns.length ? `Best presterende campagnes: ${topCampaigns.join("; ")}.` : "Er is niet genoeg campagneniveau-data om betrouwbare winnaars aan te wijzen.",
        weakCampaigns.length ? `Campagnes die aandacht nodig hebben: ${weakCampaigns.join("; ")}.` : "Er is geen duidelijke onderpresterende campagne gevonden in de upload.",
        "Budget hoort naar intentie en rendement te gaan. Bekijk Search en Shopping apart van PMax, omdat daar zoekintentie en productrendement beter zichtbaar zijn.",
        ...productLabelNotes.map((note) => note.replace("Product source uploaded", "Productbron geupload").replace("Labelizer notes", "Labelizer-notities"))
      ],
      searchTermsIntentAnalysis: [
        highIntentTerms.length
          ? `Zoektermen met sterke intentie: ${highIntentTerms.join(", ")}. Deze termen laten de kortste route zien van zoekvraag naar commerciële actie.`
          : "Er zijn geen duidelijke zoekterm-winnaars zichtbaar, of er is geen zoektermenbestand geüpload.",
        wastedTerms.length
          ? `Kandidaten voor negatieve zoekwoorden: ${wastedTerms.join(", ")}. Deze termen geven geld uit zonder zichtbare conversiewaarde.`
          : "De zoektermdata laat geen opvallende verspilling zien, of er is geen zoektermenbestand geüpload.",
        "Uitbreiding moet komen uit converterende zoekvragen, varianten met koopintentie en thema's waar de landingspagina de intentie direct kan beantwoorden."
      ],
      changeHistoryHygiene: [
        changeRows.length
          ? `${changeRows.length} change-history regels zijn geüpload. Controleer vooral wijzigingen rond dagen waarop spend, CPA of ROAS sterk bewoog.`
          : "Er is geen change-history export geüpload. Daardoor is het lastiger om prestatiebewegingen betrouwbaar te verklaren.",
        "Een gezond account heeft genoeg activiteit om actief beheer te bewijzen, maar niet zoveel overlap dat geen enkele test nog zuiver te lezen is.",
        painpoints.find((item) => item.section === "tracking")
          ? "Conversietracking moet eerst kloppen voordat budgetbeslissingen agressiever worden."
          : "Er is automatisch geen groot trackingprobleem gevonden, maar conversienamen, telling en importinstellingen moeten nog handmatig worden gecontroleerd."
      ],
      croNotes: [
        websiteNotes
          ? `Website-notities uit upload: ${websiteNotes.slice(0, 700)}${websiteNotes.length > 700 ? "..." : ""}`
          : `Er is geen website-notitiebestand geüpload. Voor ${input.businessType.replace("_", " ")} moet de CRO-check kijken naar CTA-duidelijkheid, vertrouwen, mobiele frictie, laadsnelheidsperceptie en formulier- of checkoutdrempels.`,
        input.businessType === "ecommerce"
          ? "Voor ecommerce: controleer productpagina-vertrouwen, levertijd, prijspositie, reviews, voorraad/varianten, checkout-stappen en of Shopping/PMax verkeer op de juiste categorie of productpagina landt."
          : "Voor leadgeneratie: controleer de belofte boven de vouw, formulierlengte, bewijs, call tracking, bedanktpagina-events en of de pagina exact aansluit op de advertentiebelofte."
      ],
      nextSteps: actions
    };
  }

  const report: AuditReport = {
    title: `${input.clientName} Google Ads Audit`,
    generatedAt: new Date().toISOString(),
    comparison,
    painpoints,
    executiveSummary: [
      languageHint,
      `For ${input.clientName}, the commercial picture is: ${metricLine(comparison)}`,
      topPainpoints.length
        ? `The main blockers are ${topPainpoints.map((item) => item.title.toLowerCase()).join(", ")}. These are the areas most likely to affect profit, lead quality, or scaling confidence.`
        : "The uploaded data does not show an obvious crisis point. The next step is to enrich the audit with search term, conversion, and landing-page data so the recommendations can become sharper.",
      input.strategistNotes ? `Strategist note: ${input.strategistNotes}` : "No strategist notes were added, so the report leans only on the uploaded exports."
    ],
    performanceNarrative: [
      `Current period: ${input.currentPeriod || "not specified"}. Previous period: ${input.previousPeriod || "not specified"}.`,
      `The account generated ${comparison.current.clicks.toFixed(0)} clicks from ${comparison.current.impressions.toFixed(0)} impressions at ${percent(comparison.current.ctr)} CTR. Average CPC is ${money(comparison.current.avgCpc)} and conversion rate is ${percent(comparison.current.conversionRate)}.`,
      comparison.previous.spend
        ? `Compared with the previous period, spend changed by ${percent(comparison.deltaPercent.spend)}, conversions by ${percent(comparison.deltaPercent.conversions)}, CPA by ${percent(comparison.deltaPercent.cpa)} and ROAS by ${percent(comparison.deltaPercent.roas)}. The key question is whether extra spend is buying better demand or simply more volume.`
        : "No previous-period rows were uploaded or detected. Treat the report as a current-state audit rather than a complete period-over-period diagnosis."
    ],
    campaignBudgetAnalysis: [
      topCampaigns.length ? `Best performers: ${topCampaigns.join("; ")}.` : "There is not enough campaign-level data to name reliable winners.",
      weakCampaigns.length ? `Campaigns needing attention: ${weakCampaigns.join("; ")}.` : "No clear underperforming campaign was detected from the uploaded campaign data.",
      sentenceList([
        "Budget should follow clean intent and measurable return.",
        comparison.current.roas > 0 ? `At account level, ROAS is ${comparison.current.roas.toFixed(1)}.` : "",
        "Search and Shopping deserve separate scrutiny from PMax because they expose intent and product economics more clearly."
      ]),
      ...productLabelNotes
    ],
    searchTermsIntentAnalysis: [
      highIntentTerms.length
        ? `High-intent terms to protect or expand: ${highIntentTerms.join(", ")}. These terms show the clearest route from query to commercial action.`
        : "No clear high-intent winners were visible in the uploaded search term data.",
      wastedTerms.length
        ? `Negative keyword review candidates: ${wastedTerms.join(", ")}. These terms spent money without visible conversion output.`
        : "The uploaded search terms do not show obvious waste, or no search term file was uploaded.",
      "Expansion should come from converting queries, close variants with buyer language, and themes where landing pages can answer the intent without forcing the visitor to work."
    ],
    changeHistoryHygiene: [
      changeRows.length
        ? `${changeRows.length} change-history rows were uploaded. Review changes around the dates where spend, CPA, or ROAS moved most sharply.`
        : "No change-history export was uploaded. That limits confidence when explaining why performance moved.",
      "A healthy account has enough change history to prove active management, but not so much noise that every test overlaps with another test.",
      painpoints.find((item) => item.section === "tracking")
        ? "Conversion tracking needs attention before budget decisions become aggressive."
        : "No major conversion tracking issue was automatically detected, but imported conversion names and counting settings should still be checked manually."
    ],
    croNotes: [
      websiteNotes
        ? `Website notes uploaded: ${websiteNotes.slice(0, 700)}${websiteNotes.length > 700 ? "..." : ""}`
        : `No website note file was uploaded. For a ${input.businessType.replace("_", " ")} account, the CRO review should check CTA clarity, trust, mobile friction, page speed perception, and form or checkout effort.`,
      input.businessType === "ecommerce"
        ? "For ecommerce, review product-page trust, delivery clarity, pricing, review depth, variant availability, checkout steps, and whether PMax/Shopping traffic lands on the right category or product."
        : "For lead generation, review above-the-fold offer clarity, form length, proof, phone tracking, thank-you events, and whether the page answers the exact promise made in the ad."
    ],
    nextSteps: actions
  };

  return report;
}

import { ProseTable } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import type { Locale } from "@/i18n/config"

/** How results are ordered, as published. The numbers are the ones in supabase/migrations/*_v2_search_catalog.sql. */
export function RankingContent({ locale }: { locale: Locale }) {
  return locale === "de" ? <German /> : <English />
}

function English() {
  return (
    <>
      <p>The order of results cannot be bought. This page says exactly how it comes about.</p>

      <h2>Searching</h2>
      <p>When you search, the match between your words and a listing comes first. A match in the name counts most, then the tagline and use cases, then the description, categories and integrations. Small typing mistakes are tolerated. German and English word forms are both understood.</p>
      <p>Among listings that match about equally well, the organic score decides.</p>

      <h2>The organic score</h2>
      <ProseTable
        head={["Share", "Signal", "What it is"]}
        rows={[
          [<>30%</>, <>Evidence completeness</>, <>How many of the expected facts have an answer. Verified counts fully, a vendor statement half.</>],
          [<>25%</>, <>Engagement</>, <>Visits to the product’s site, saves and reviews on PWANova. Counted on a logarithmic scale, so large numbers gain little.</>],
          [<>20%</>, <>Profile completeness</>, <>Description, screenshots, category, company, pricing, languages and links to documents.</>],
          [<>15%</>, <>Rating</>, <>The average rating, pulled towards a neutral value while there are only a few ratings. Without ratings this share is zero.</>],
          [<>10%</>, <>Freshness</>, <>How recently the evidence was verified. It falls to zero over 180 days.</>],
        ]}
      />
      <p>No plan, no payment and no sponsorship is part of this score.</p>

      <h2>Sorting</h2>
      <ul>
        <li><strong>Best match</strong>: text match plus the organic score, as described above.</li>
        <li><strong>Recently verified</strong>: the date of the last verified evidence.</li>
        <li><strong>Best rated</strong>: the same weighted rating. Listings without ratings come last.</li>
        <li><strong>Trending</strong>: activity in the last seven days.</li>
        <li><strong>Newest</strong>: the date of listing.</li>
        <li><strong>Name</strong>: alphabetical.</li>
      </ul>

      <h2>Filters</h2>
      <p>A filter for a fact shows products for which the answer is yes. With “verified evidence only”, vendor statements are ignored. Products without an answer are left out of a filtered list; they are never shown as a no.</p>
      <p>The numbers next to the filters count all public listings with that value, not only the ones in your current result.</p>

      <h2>Editor’s picks</h2>
      <p>The PWANova team marks some listings as editor’s picks. They are labelled and shown in their own section. Being a pick does not change a listing’s position in search results.</p>

      <h2>Sponsored placements</h2>
      <p>A sponsored placement is always labelled “Sponsored” (in German “Anzeige”), is shown in its own block and is not part of the organic list. See <Link href="/sponsorship">sponsorship transparency</Link>.</p>

      <h2>Launches</h2>
      <p>Launches in their 30-day window are ordered by: the number of distinct signed-in people who saved, followed, reviewed or visited the product during the window; the evidence completeness; the profile completeness; and how recent the launch is. Anonymous clicks and repeated actions by one account add nothing. The maker’s own actions are not counted.</p>

      <h2>Requests</h2>
      <p>The short list for a software request is computed from documented facts only: how many of the requirements are verified or stated. A documented no on a required fact rules a product out; a missing answer does not. The same request and the same catalogue always give the same list.</p>

      <h2>Ratings and reviews</h2>
      <p>One rating per person and product counts. Owners cannot rate their own products. Reviews come from signed-in accounts; PWANova does not verify that a reviewer is a customer, and says so next to every review.</p>

      <h2>Sample listings</h2>
      <p>Fabricated sample listings exist for development only. They are excluded from every public list, from search and from the sitemap.</p>
    </>
  )
}

function German() {
  return (
    <>
      <p>Die Reihenfolge der Ergebnisse ist nicht käuflich. Diese Seite beschreibt genau, wie sie zustande kommt.</p>

      <h2>Suche</h2>
      <p>Bei einer Suche zählt zuerst, wie gut deine Wörter zu einem Eintrag passen. Ein Treffer im Namen zählt am meisten, dann Kurzbeschreibung und Anwendungsfälle, dann Beschreibung, Kategorien und Integrationen. Kleine Tippfehler werden toleriert. Deutsche und englische Wortformen werden verstanden.</p>
      <p>Unter Einträgen, die etwa gleich gut passen, entscheidet der organische Wert.</p>

      <h2>Der organische Wert</h2>
      <ProseTable
        head={["Anteil", "Signal", "Was es ist"]}
        rows={[
          [<>30 %</>, <>Vollständigkeit der Nachweise</>, <>Zu wie vielen der erwarteten Angaben eine Antwort vorliegt. Geprüft zählt voll, eine Angabe des Anbieters zur Hälfte.</>],
          [<>25 %</>, <>Nutzung</>, <>Besuche der Produkt-Website, gespeicherte Einträge und Rezensionen bei PWANova. Logarithmisch gezählt, große Zahlen bringen also wenig zusätzlich.</>],
          [<>20 %</>, <>Vollständigkeit des Profils</>, <>Beschreibung, Screenshots, Kategorie, Unternehmen, Preise, Sprachen und Links zu Dokumenten.</>],
          [<>15 %</>, <>Bewertung</>, <>Die durchschnittliche Bewertung, bei wenigen Bewertungen zu einem neutralen Wert hin gewichtet. Ohne Bewertungen ist dieser Anteil null.</>],
          [<>10 %</>, <>Aktualität</>, <>Wie kurz die letzte Prüfung der Nachweise zurückliegt. Der Anteil sinkt über 180 Tage auf null.</>],
        ]}
      />
      <p>Kein Tarif, keine Zahlung und kein Sponsoring fließt in diesen Wert ein.</p>

      <h2>Sortierung</h2>
      <ul>
        <li><strong>Beste Übereinstimmung</strong>: Textübereinstimmung plus organischer Wert, wie oben beschrieben.</li>
        <li><strong>Zuletzt geprüft</strong>: das Datum des zuletzt geprüften Nachweises.</li>
        <li><strong>Beste Bewertung</strong>: dieselbe gewichtete Bewertung. Einträge ohne Bewertungen stehen am Ende.</li>
        <li><strong>Im Trend</strong>: Aktivität der letzten sieben Tage.</li>
        <li><strong>Neueste</strong>: das Datum der Aufnahme.</li>
        <li><strong>Name</strong>: alphabetisch.</li>
      </ul>

      <h2>Filter</h2>
      <p>Ein Filter zu einer Angabe zeigt Produkte, bei denen die Antwort Ja lautet. Mit „Nur geprüfte Nachweise“ werden Angaben der Anbieter ignoriert. Produkte ohne Antwort erscheinen in einer gefilterten Liste nicht; sie werden nie als Nein dargestellt.</p>
      <p>Die Zahlen neben den Filtern zählen alle öffentlichen Einträge mit diesem Wert, nicht nur die in deinem aktuellen Ergebnis.</p>

      <h2>Empfehlungen der Redaktion</h2>
      <p>Das Team von PWANova kennzeichnet einzelne Einträge als Empfehlung der Redaktion. Sie sind gekennzeichnet und stehen in einem eigenen Bereich. An der Position eines Eintrags in den Suchergebnissen ändert das nichts.</p>

      <h2>Gesponserte Platzierungen</h2>
      <p>Eine gesponserte Platzierung ist immer mit „Anzeige“ gekennzeichnet, steht in einem eigenen Block und gehört nicht zur organischen Liste. Mehr dazu unter <Link href="/sponsorship">Transparenz beim Sponsoring</Link>.</p>

      <h2>Launches</h2>
      <p>Launches im 30-Tage-Fenster werden geordnet nach: der Zahl unterschiedlicher angemeldeter Personen, die das Produkt im Fenster gespeichert, abonniert, rezensiert oder besucht haben; der Vollständigkeit der Nachweise; der Vollständigkeit des Profils; und der Aktualität des Launches. Anonyme Klicks und wiederholte Aktionen eines Kontos zählen nicht. Aktionen des Anbieters selbst werden nicht gezählt.</p>

      <h2>Anfragen</h2>
      <p>Die Auswahl zu einer Software-Anfrage wird ausschließlich aus dokumentierten Angaben berechnet: wie viele der Anforderungen geprüft oder angegeben sind. Ein dokumentiertes Nein bei einer geforderten Angabe schließt ein Produkt aus; eine fehlende Antwort nicht. Dieselbe Anfrage und derselbe Katalog ergeben immer dieselbe Liste.</p>

      <h2>Bewertungen und Rezensionen</h2>
      <p>Pro Person und Produkt zählt eine Bewertung. Inhaber können ihre eigenen Produkte nicht bewerten. Rezensionen stammen von angemeldeten Konten; PWANova prüft nicht, ob jemand Kunde ist, und weist bei jeder Rezension darauf hin.</p>

      <h2>Beispieleinträge</h2>
      <p>Erfundene Beispieleinträge gibt es nur für die Entwicklung. Sie sind von allen öffentlichen Listen, von der Suche und von der Sitemap ausgeschlossen.</p>
    </>
  )
}

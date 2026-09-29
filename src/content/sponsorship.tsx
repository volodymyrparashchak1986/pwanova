import { Link } from "@/components/i18n/link"
import type { Locale } from "@/i18n/config"

export function SponsorshipContent({ locale, active }: { locale: Locale; active: boolean }) {
  return locale === "de" ? <German active={active} /> : <English active={active} />
}

function English({ active }: { active: boolean }) {
  return (
    <>
      <p><strong>{active ? "Sponsored placements are switched on." : "There are no sponsored placements on PWANova at the moment."}</strong> {active ? "Every one of them follows the rules on this page." : "This page describes the rules that apply once there are."}</p>

      <h2>The rules</h2>
      <ol>
        <li>A sponsored placement is labelled <strong>Sponsored</strong> in English and <strong>Anzeige</strong> in German, in text, on the placement itself.</li>
        <li>It is shown in its own block, apart from the organic results. It never appears inside the organic list.</li>
        <li>It does not change the organic position of any listing, neither the sponsor’s nor anybody else’s.</li>
        <li>It does not change evidence, verification status, ratings or reviews.</li>
        <li>A sponsored product is shown with the same evidence as every other product, including what is not verified.</li>
      </ol>

      <h2>Where placements can appear</h2>
      <ul>
        <li>On the home page, in a separate block.</li>
        <li>On a category page, above the results, in a separate block.</li>
        <li>On the discover page, above the results, in a separate block.</li>
        <li>On the launches page, in a separate block.</li>
        <li>In the newsletter, marked as sponsored.</li>
      </ul>

      <h2>What cannot be bought</h2>
      <ul>
        <li>A position in search results.</li>
        <li>A verification status or a verified answer.</li>
        <li>Ratings, reviews, or their removal.</li>
        <li>Contact details of people who create software requests.</li>
        <li>The label “editor’s pick”.</li>
      </ul>

      <h2>Paid plans</h2>
      <p>Paid plans for makers and vendors are tools: a review workflow for evidence, analytics, launches and access to matching requests. None of them is a ranking factor. See <Link href="/pricing">plans and pricing</Link> and <Link href="/how-ranking-works">how ranking works</Link>.</p>

      <h2>Affiliate links</h2>
      <p>PWANova does not use affiliate links. Links to products go to the address the listing names, without tracking parameters added by PWANova.</p>
    </>
  )
}

function German({ active }: { active: boolean }) {
  return (
    <>
      <p><strong>{active ? "Gesponserte Platzierungen sind eingeschaltet." : "Derzeit gibt es bei PWANova keine gesponserten Platzierungen."}</strong> {active ? "Für jede gelten die Regeln auf dieser Seite." : "Diese Seite beschreibt die Regeln, die gelten, sobald es welche gibt."}</p>

      <h2>Die Regeln</h2>
      <ol>
        <li>Eine gesponserte Platzierung ist auf Deutsch mit <strong>Anzeige</strong> und auf Englisch mit <strong>Sponsored</strong> gekennzeichnet – als Text, direkt an der Platzierung.</li>
        <li>Sie steht in einem eigenen Block, getrennt von den organischen Ergebnissen. In der organischen Liste erscheint sie nie.</li>
        <li>Sie verändert die organische Position keines Eintrags, weder die des Sponsors noch die eines anderen.</li>
        <li>Sie verändert weder Nachweise noch Prüfstatus, Bewertungen oder Rezensionen.</li>
        <li>Ein gesponsertes Produkt wird mit denselben Nachweisen gezeigt wie jedes andere – einschließlich dessen, was nicht geprüft ist.</li>
      </ol>

      <h2>Wo Platzierungen erscheinen können</h2>
      <ul>
        <li>Auf der Startseite, in einem eigenen Block.</li>
        <li>Auf einer Kategorieseite, über den Ergebnissen, in einem eigenen Block.</li>
        <li>Auf der Seite „Entdecken“, über den Ergebnissen, in einem eigenen Block.</li>
        <li>Auf der Launch-Seite, in einem eigenen Block.</li>
        <li>Im Newsletter, als Anzeige gekennzeichnet.</li>
      </ul>

      <h2>Was nicht käuflich ist</h2>
      <ul>
        <li>Eine Position in den Suchergebnissen.</li>
        <li>Ein Prüfstatus oder eine geprüfte Antwort.</li>
        <li>Bewertungen, Rezensionen oder deren Entfernung.</li>
        <li>Kontaktdaten von Personen, die Software-Anfragen erstellen.</li>
        <li>Die Kennzeichnung „Empfehlung der Redaktion“.</li>
      </ul>

      <h2>Bezahlte Tarife</h2>
      <p>Bezahlte Tarife für Anbieter sind Werkzeuge: ein Ablauf zur Sichtung von Nachweisen, Auswertungen, Launches und der Zugang zu passenden Anfragen. Keiner davon ist ein Ranking-Faktor. Mehr unter <Link href="/pricing">Tarife und Preise</Link> und <Link href="/how-ranking-works">So funktioniert das Ranking</Link>.</p>

      <h2>Affiliate-Links</h2>
      <p>PWANova verwendet keine Affiliate-Links. Links zu Produkten führen zu der Adresse, die der Eintrag nennt – ohne von PWANova angehängte Tracking-Parameter.</p>
    </>
  )
}

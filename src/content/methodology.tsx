import { ProseTable } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import type { Locale } from "@/i18n/config"

/**
 * The verification methodology as published. It describes what the code does
 * (src/lib/v2/verify/, supabase/migrations/*_v2_evidence.sql); when one changes, the other has to.
 */
export function MethodologyContent({ locale }: { locale: Locale }) {
  return locale === "de" ? <German /> : <English />
}

function English() {
  return (
    <>
      <p>PWANova records what is documented about a product and where that information comes from. It is a record of evidence. It is not a legal assessment, not a security audit and not a certificate.</p>

      <h2>Three answers, never two</h2>
      <p>Every fact about a product has one of three answers:</p>
      <ul>
        <li><strong>Yes</strong>: a source says so.</li>
        <li><strong>No</strong>: a source says so, or a technical check showed it.</li>
        <li><strong>Not verified</strong>: nobody has checked it and nobody has stated it.</li>
      </ul>
      <p>Not verified is never treated as no. A filter for “DPA available” leaves out products without an answer, and a filter never shows them as lacking one.</p>

      <h2>Where an answer comes from</h2>
      <ProseTable
        head={["Label", "Meaning"]}
        rows={[
          [<>Checked by PWANova</>, <>PWANova fetched the source itself and checked it automatically.</>],
          [<>Reviewed by PWANova</>, <>A moderator read the source. The source and the reason are recorded.</>],
          [<>Stated by the vendor</>, <>The verified owner of the listing states it. PWANova has not confirmed it.</>],
          [<>Submitted by a user</>, <>Somebody submitted it. It is shown only after a moderator has checked the source.</>],
        ]}
      />
      <p>What PWANova verified and what the vendor states are stored separately. When both exist, both are shown. A vendor statement cannot overwrite a verified result.</p>

      <h2>What is checked automatically</h2>
      <p>A verification run fetches the start page of the product and the documents it links to. It reads text only and never runs code from the site.</p>
      <ul>
        <li>The website answers, and it is served over HTTPS.</li>
        <li>The start page links a web app manifest with a name and a start address.</li>
        <li>A <code>security.txt</code> is published at the standard address.</li>
        <li>The start page declares German as a language.</li>
        <li>The start page links to: privacy policy, legal notice, terms, data processing agreement, subprocessor list, pricing, API documentation, MCP documentation, changelog, contact, source repository, information on the use of AI.</li>
      </ul>
      <p>A document counts as found only after its own page was fetched and reads like that document. A PDF cannot be read by the check; it counts only when its name and its address are unambiguous.</p>

      <h2>What a missing link means</h2>
      <p>If the start page does not link to a document, PWANova records that it found no link. It does not record a no. The product may well have the document somewhere else.</p>
      <p>A no is recorded only for technical observations that can be made with certainty at one address: no HTTPS, no manifest on the start page, no <code>security.txt</code> at the standard address.</p>

      <h2>When a check cannot run</h2>
      <p>If a page cannot be reached, the result is “could not re-check”. The earlier answer and its date stay exactly as they were. A temporary outage never turns a yes into a no.</p>

      <h2>How often</h2>
      <ul>
        <li>Every listing is checked again after 30 days.</li>
        <li>The owner can request a re-check, up to three times a day.</li>
        <li>Evidence that was verified more than 180 days ago is marked as outdated.</li>
      </ul>

      <h2>History</h2>
      <p>Evidence is never edited or deleted. A new result is a new entry; the previous one stays visible and is marked as replaced. Every product has a public <em>evidence</em> page with the full history.</p>

      <h2>Evidence completeness</h2>
      <p>The percentage shows for how many of the expected facts there is an answer. A verified answer counts fully, a vendor statement counts half, and no answer counts nothing. The number measures how transparent a listing is. It says nothing about whether a product complies with any law.</p>

      <h2>Verification status</h2>
      <ProseTable
        head={["Status", "Meaning"]}
        rows={[
          [<>Unverified</>, <>PWANova has not verified any of the expected evidence.</>],
          [<>Partially verified</>, <>PWANova verified some of the expected evidence.</>],
          [<>Evidence verified</>, <>PWANova verified at least half of the expected evidence, including HTTPS, a privacy policy and a legal notice.</>],
          [<>Evidence outdated</>, <>The last verification is older than 180 days.</>],
          [<>Check failed</>, <>The last run could not complete and nothing has been verified yet.</>],
        ]}
      />

      <h2>Ownership</h2>
      <p>“Ownership verified” means that somebody demonstrated control of the product’s domain by serving a file with a one-time token. It says who may speak for the listing. It says nothing about quality, security or compliance.</p>

      <h2>What PWANova does not do</h2>
      <ul>
        <li>It does not assess whether a document is legally sufficient.</li>
        <li>It does not certify compliance with the GDPR, the EU AI Act or any other law.</li>
        <li>It does not test security and does not log in to products.</li>
        <li>It does not guess. Where nothing is documented, it says not verified.</li>
      </ul>

      <h2>The crawler</h2>
      <p>Requests are sent with the user agent <code>PWANovaBot/1.0</code>. The crawler follows <code>robots.txt</code>, opens public addresses only, sends at most sixteen requests per run and stops after a time limit.</p>

      <h2>Something is wrong?</h2>
      <p>Every product’s evidence page has a link to report incorrect or outdated information. A moderator reads every report. Owners can submit their own evidence after <Link href="/for-makers">claiming their listing</Link>.</p>
    </>
  )
}

function German() {
  return (
    <>
      <p>PWANova hält fest, was über ein Produkt dokumentiert ist und woher diese Information stammt. Es ist eine Sammlung von Nachweisen – keine rechtliche Bewertung, keine Sicherheitsprüfung und kein Zertifikat.</p>

      <h2>Drei Antworten, nie zwei</h2>
      <p>Zu jeder Angabe über ein Produkt gibt es eine von drei Antworten:</p>
      <ul>
        <li><strong>Ja</strong>: Eine Quelle sagt es.</li>
        <li><strong>Nein</strong>: Eine Quelle sagt es, oder eine technische Prüfung hat es gezeigt.</li>
        <li><strong>Nicht geprüft</strong>: Niemand hat es geprüft und niemand hat es angegeben.</li>
      </ul>
      <p>„Nicht geprüft“ wird nie wie ein Nein behandelt. Ein Filter „AVV verfügbar“ lässt Produkte ohne Antwort aus und stellt sie nie so dar, als fehle ihnen etwas.</p>

      <h2>Woher eine Antwort stammt</h2>
      <ProseTable
        head={["Kennzeichnung", "Bedeutung"]}
        rows={[
          [<>Von PWANova geprüft</>, <>PWANova hat die Quelle selbst abgerufen und automatisch geprüft.</>],
          [<>Von PWANova gesichtet</>, <>Ein Moderator hat die Quelle gelesen. Quelle und Begründung werden festgehalten.</>],
          [<>Angabe des Anbieters</>, <>Der verifizierte Inhaber des Eintrags gibt es an. PWANova hat es nicht bestätigt.</>],
          [<>Von einem Nutzer gemeldet</>, <>Jemand hat es eingereicht. Es erscheint erst, nachdem ein Moderator die Quelle geprüft hat.</>],
        ]}
      />
      <p>Was PWANova geprüft hat und was der Anbieter angibt, wird getrennt gespeichert. Gibt es beides, wird beides angezeigt. Eine Angabe des Anbieters kann ein geprüftes Ergebnis nicht überschreiben.</p>

      <h2>Was automatisch geprüft wird</h2>
      <p>Ein Prüflauf ruft die Startseite des Produkts und die dort verlinkten Dokumente ab. Er liest ausschließlich Text und führt nie Code der Website aus.</p>
      <ul>
        <li>Die Website antwortet und wird über HTTPS ausgeliefert.</li>
        <li>Die Startseite verlinkt ein Web-App-Manifest mit Namen und Startadresse.</li>
        <li>Unter der Standardadresse ist eine <code>security.txt</code> veröffentlicht.</li>
        <li>Die Startseite gibt Deutsch als Sprache an.</li>
        <li>Die Startseite verlinkt auf: Datenschutzerklärung, Impressum, Nutzungsbedingungen, Auftragsverarbeitungsvertrag, Liste der Unterauftragsverarbeiter, Preise, API-Dokumentation, MCP-Dokumentation, Changelog, Kontakt, Quellcode-Repository, Informationen zum Einsatz von KI.</li>
      </ul>
      <p>Ein Dokument gilt erst als gefunden, wenn seine eigene Seite abgerufen wurde und sich wie dieses Dokument liest. Ein PDF kann die Prüfung nicht lesen; es zählt nur, wenn Name und Adresse eindeutig sind.</p>

      <h2>Was ein fehlender Link bedeutet</h2>
      <p>Verlinkt die Startseite ein Dokument nicht, hält PWANova fest, dass kein Link gefunden wurde. Ein Nein wird daraus nicht. Das Dokument kann durchaus an anderer Stelle existieren.</p>
      <p>Ein Nein wird nur bei technischen Beobachtungen festgehalten, die sich an einer Adresse sicher treffen lassen: kein HTTPS, kein Manifest auf der Startseite, keine <code>security.txt</code> unter der Standardadresse.</p>

      <h2>Wenn eine Prüfung nicht möglich ist</h2>
      <p>Ist eine Seite nicht erreichbar, lautet das Ergebnis „erneute Prüfung nicht möglich“. Die frühere Antwort und ihr Datum bleiben unverändert. Ein vorübergehender Ausfall macht aus einem Ja nie ein Nein.</p>

      <h2>Wie oft</h2>
      <ul>
        <li>Jeder Eintrag wird nach 30 Tagen erneut geprüft.</li>
        <li>Der Inhaber kann bis zu dreimal täglich eine erneute Prüfung anfordern.</li>
        <li>Nachweise, deren Prüfung mehr als 180 Tage zurückliegt, werden als veraltet gekennzeichnet.</li>
      </ul>

      <h2>Verlauf</h2>
      <p>Nachweise werden nie bearbeitet oder gelöscht. Ein neues Ergebnis ist ein neuer Eintrag; der bisherige bleibt sichtbar und wird als ersetzt gekennzeichnet. Jedes Produkt hat eine öffentliche <em>Nachweis</em>-Seite mit dem vollständigen Verlauf.</p>

      <h2>Vollständigkeit der Nachweise</h2>
      <p>Der Prozentwert zeigt, zu wie vielen der erwarteten Angaben eine Antwort vorliegt. Eine geprüfte Antwort zählt voll, eine Angabe des Anbieters zur Hälfte, keine Antwort zählt nicht. Der Wert misst, wie transparent ein Eintrag ist. Er sagt nichts darüber aus, ob ein Produkt ein Gesetz einhält.</p>

      <h2>Prüfstatus</h2>
      <ProseTable
        head={["Status", "Bedeutung"]}
        rows={[
          [<>Ungeprüft</>, <>PWANova hat keinen der erwarteten Nachweise geprüft.</>],
          [<>Teilweise geprüft</>, <>PWANova hat einen Teil der erwarteten Nachweise geprüft.</>],
          [<>Nachweise geprüft</>, <>PWANova hat mindestens die Hälfte der erwarteten Nachweise geprüft, darunter HTTPS, Datenschutzerklärung und Impressum.</>],
          [<>Nachweise veraltet</>, <>Die letzte Prüfung liegt mehr als 180 Tage zurück.</>],
          [<>Prüfung fehlgeschlagen</>, <>Der letzte Lauf konnte nicht abgeschlossen werden, und bisher ist nichts geprüft.</>],
        ]}
      />

      <h2>Inhaberschaft</h2>
      <p>„Inhaberschaft verifiziert“ bedeutet: Jemand hat die Kontrolle über die Domain des Produkts nachgewiesen, indem eine Datei mit einem einmaligen Token bereitgestellt wurde. Das sagt, wer für den Eintrag sprechen darf. Über Qualität, Sicherheit oder Rechtskonformität sagt es nichts.</p>

      <h2>Was PWANova nicht tut</h2>
      <ul>
        <li>PWANova bewertet nicht, ob ein Dokument rechtlich ausreicht.</li>
        <li>PWANova bescheinigt keine Konformität mit der DSGVO, der KI-Verordnung der EU oder einem anderen Gesetz.</li>
        <li>PWANova testet keine Sicherheit und meldet sich nicht in Produkten an.</li>
        <li>PWANova rät nicht. Wo nichts dokumentiert ist, steht „nicht geprüft“.</li>
      </ul>

      <h2>Der Crawler</h2>
      <p>Anfragen tragen die Kennung <code>PWANovaBot/1.0</code>. Der Crawler beachtet die <code>robots.txt</code>, ruft nur öffentliche Adressen ab, sendet pro Lauf höchstens sechzehn Anfragen und bricht nach einem Zeitlimit ab.</p>

      <h2>Etwas stimmt nicht?</h2>
      <p>Auf der Nachweis-Seite jedes Produkts kannst du falsche oder veraltete Angaben melden. Jede Meldung wird von einem Moderator gelesen. Inhaber können eigene Nachweise einreichen, nachdem sie ihren <Link href="/for-makers">Eintrag beansprucht</Link> haben.</p>
    </>
  )
}

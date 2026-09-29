import { ProseTable } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import type { Locale } from "@/i18n/config"
import type { OperatorInfo } from "@/lib/data/catalog"

/**
 * Legal pages. They are TEMPLATES: the structure follows what German and EU law expect of such pages,
 * the facts about processing are taken from the code, and everything about the operator comes from
 * site_settings.operator, which only the operator can fill in. Nothing here was reviewed by a lawyer,
 * and every page says so until the operator removes the notice after a review.
 */
const Missing = ({ children }: { children: React.ReactNode }) => <span className="rounded bg-warn/15 px-1.5 py-0.5 text-warn">{children}</span>

export function OperatorBlock({ operator, locale }: { operator: OperatorInfo; locale: Locale }) {
  const de = locale === "de"
  const missing = <Missing>{de ? "noch nicht eingetragen" : "not entered yet"}</Missing>
  const address = [operator.street, [operator.postal_code, operator.city].filter(Boolean).join(" "), operator.country].filter(Boolean)
  return (
    <dl className="mt-3 grid gap-3 text-[15px] sm:grid-cols-[14rem_1fr]">
      <dt className="font-medium text-foreground">{de ? "Anbieter" : "Operator"}</dt>
      <dd>{operator.legal_name ?? missing}{address.length > 0 ? address.map((l) => <span key={l} className="block">{l}</span>) : <span className="block">{missing}</span>}</dd>
      <dt className="font-medium text-foreground">{de ? "Kontakt" : "Contact"}</dt>
      <dd>{operator.email ?? missing}{operator.phone && <span className="block">{operator.phone}</span>}</dd>
      {operator.represented_by && <><dt className="font-medium text-foreground">{de ? "Vertreten durch" : "Represented by"}</dt><dd>{operator.represented_by}</dd></>}
      {operator.register && <><dt className="font-medium text-foreground">{de ? "Registereintrag" : "Register entry"}</dt><dd>{operator.register}</dd></>}
      {operator.vat_id && <><dt className="font-medium text-foreground">{de ? "Umsatzsteuer-ID" : "VAT ID"}</dt><dd>{operator.vat_id}</dd></>}
      <dt className="font-medium text-foreground">{de ? "Verantwortlich für den Inhalt" : "Responsible for content"}</dt>
      <dd>{operator.responsible_for_content ?? operator.legal_name ?? missing}</dd>
    </dl>
  )
}

export const operatorComplete = (o: OperatorInfo) => Boolean(o.legal_name && o.street && o.city && o.email)

export function ImprintContent({ locale, operator }: { locale: Locale; operator: OperatorInfo }) {
  const de = locale === "de"
  return (
    <>
      <h2>{de ? "Angaben zum Anbieter" : "Information about the operator"}</h2>
      <OperatorBlock operator={operator} locale={locale} />
      <h2>{de ? "Haftung für Inhalte" : "Liability for content"}</h2>
      <p>{de
        ? "Einträge, Angaben von Anbietern und Rezensionen stammen von Dritten und sind als solche gekennzeichnet. PWANova prüft automatisch und manuell, was auf der Seite zur Prüfmethodik beschrieben ist. Eine Gewähr für die Richtigkeit von Angaben Dritter wird nicht übernommen."
        : "Listings, vendor statements and reviews come from third parties and are labelled as such. PWANova checks, automatically and by hand, what the methodology page describes. No guarantee is given for the accuracy of information provided by third parties."}</p>
      <h2>{de ? "Hinweise auf Rechtsverstöße" : "Reporting unlawful content"}</h2>
      <p>{de
        ? "Rechtswidrige Inhalte kannst du über „Melden“ am jeweiligen Eintrag oder an der Rezension oder über die oben genannte Kontaktadresse mitteilen. Meldungen werden von einem Menschen gelesen."
        : "Unlawful content can be reported with the report link on the listing or the review, or through the contact address above. Reports are read by a person."}</p>
      <h2>{de ? "Namen und Marken Dritter" : "Third-party names and trademarks"}</h2>
      <p>{de
        ? "Produkt- und Firmennamen dienen ausschließlich der Bezeichnung der gelisteten Produkte. Eine Verbindung zu PWANova oder eine Empfehlung durch die Rechteinhaber ist damit nicht verbunden."
        : "Product and company names are used solely to identify the listed products. They do not imply any affiliation with PWANova or endorsement by their owners."}</p>
    </>
  )
}

export function PrivacyContent({ locale, operator }: { locale: Locale; operator: OperatorInfo }) {
  return locale === "de" ? <PrivacyDe operator={operator} /> : <PrivacyEn operator={operator} />
}

function PrivacyEn({ operator }: { operator: OperatorInfo }) {
  return (
    <>
      <h2>Who is responsible</h2>
      <OperatorBlock operator={operator} locale="en" />

      <h2>In short</h2>
      <ul>
        <li>No advertising trackers, no third-party analytics, no tracking pixels.</li>
        <li>Visiting the site stores no identifier on your device. A cookie is written only when you sign in or pick a language.</li>
        <li>Statistics are counted on our own server, without an identifier for you.</li>
        <li>Contact details of software requests are stored separately and are shared only when you decide so, per vendor.</li>
      </ul>

      <h2>Visiting the site</h2>
      <p>When a page is requested, the hosting provider processes the IP address, the time, the address requested and the browser’s user agent in order to deliver the page and to protect the service. Legal basis: legitimate interest in operating the site securely (Art. 6(1)(f) GDPR).</p>

      <h2>Cookies and storage on your device</h2>
      <ProseTable
        head={["What", "Purpose", "When", "How long"]}
        rows={[
          [<>Session cookies (<code>sb-…</code>)</>, <>Keep you signed in</>, <>After you sign in</>, <>Until you sign out or the session expires</>],
          [<><code>pwn_next</code></>, <>Remembers the page to return to after signing in</>, <>When you start to sign in</>, <>15 minutes, or until you are signed in</>],
          [<><code>pwn_locale</code></>, <>Remembers the language you picked</>, <>When you switch the language or save it in your profile</>, <>One year</>],
          [<>Local storage: comparison</>, <>Keeps the apps you selected for comparison</>, <>When you add an app to a comparison</>, <>Until you clear it</>],
          [<>Local storage: review draft</>, <>Keeps the text of a review you are writing</>, <>While you write a review</>, <>24 hours, or until you post it</>],
          [<>Service worker cache</>, <>Keeps static files of this site and the offline page, so pages load faster and a notice can be shown without a connection. It contains files of the site only, nothing about you.</>, <>On your first visit, in browsers that support it</>, <>Until a new version of the site replaces it</>],
        ]}
      />
      <p>The cookies and the local storage are necessary for a function you asked for. Nothing in this list is used for advertising or for recognising you across sites, so no consent banner is shown.</p>

      <h2>Statistics</h2>
      <p>PWANova counts profile views, visits to a product’s site, saves and similar actions, per product. An event contains the product, the kind of action, the traffic source (for example “search” or “direct”), the language edition and, if you are signed in, your account. It contains no IP address. To avoid counting the same action twice, the server keeps, for at most one day, a hash of the IP address that is salted and changes every day. Raw events are deleted after 180 days. Legal basis: legitimate interest in measuring the use of the catalogue (Art. 6(1)(f) GDPR).</p>

      <h2>Account</h2>
      <p>To sign in we process your e-mail address and, if you sign in through a provider such as GitHub or Google, the identifier, name and avatar that provider passes on. Your profile shows the name, avatar, short text and website you enter. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).</p>

      <h2>Reviews, ratings and reports</h2>
      <p>Reviews and ratings are published with your display name. You can edit or delete them at any time. Reports are visible to moderators only.</p>

      <h2>Listings and evidence</h2>
      <p>Information you submit about a product is published with its origin (for example “stated by the vendor”). History of evidence is kept, because showing what changed is the purpose of the record.</p>

      <h2>Software requests</h2>
      <p>The requirements of a request may be shown to matching vendors or, if you choose “public”, to everybody. They must not contain personal data. Contact details are stored in a separate table that only you can read. They are passed to a vendor only after you agreed for that vendor; the wording you agreed to, the fields and the time are recorded. You can withdraw the consent at any time, with effect for the future. Legal basis: consent (Art. 6(1)(a) GDPR). Contact details are never sold and are not part of any paid plan.</p>

      <h2>Newsletter</h2>
      <p>If you subscribe, we store your e-mail address, the language, the time and the wording of your consent. Legal basis: consent (Art. 6(1)(a) GDPR). You can unsubscribe at any time. No newsletter has been sent yet; a sending service will be named here before the first issue.</p>

      <h2>Checks of product websites</h2>
      <p>PWANova fetches public pages of listed products. It does not process personal data of the visitors of those sites.</p>

      <h2>Processors</h2>
      <ProseTable
        head={["Service", "Purpose", "Location"]}
        rows={[
          [<>Vercel Inc.</>, <>Hosting and delivery of the site; server functions run in Frankfurt (fra1)</>, <><Missing>to be confirmed by the operator</Missing></>],
          [<>Supabase Inc.</>, <>Database, sign-in, file storage</>, <><Missing>region to be confirmed by the operator</Missing></>],
        ]}
      />
      <p><Missing>The operator has to add here: data processing agreements, the region of the database, and the safeguards for any transfer to a third country.</Missing></p>

      <h2>Your rights</h2>
      <p>You have the right of access, rectification, erasure, restriction of processing, data portability and the right to object. You can withdraw a consent at any time. You have the right to lodge a complaint with a data protection supervisory authority.</p>
      <p>To delete your account and the data connected to it, write to the contact address above.</p>
    </>
  )
}

function PrivacyDe({ operator }: { operator: OperatorInfo }) {
  return (
    <>
      <h2>Verantwortlicher</h2>
      <OperatorBlock operator={operator} locale="de" />

      <h2>Kurz gesagt</h2>
      <ul>
        <li>Keine Werbe-Tracker, keine Analyse-Dienste Dritter, keine Tracking-Pixel.</li>
        <li>Der Besuch der Website speichert keine Kennung auf deinem Gerät. Ein Cookie wird erst gesetzt, wenn du dich anmeldest oder eine Sprache wählst.</li>
        <li>Statistiken werden auf unserem eigenen Server gezählt, ohne Kennung für dich.</li>
        <li>Kontaktdaten zu Software-Anfragen werden getrennt gespeichert und nur weitergegeben, wenn du das für einen Anbieter entscheidest.</li>
      </ul>

      <h2>Besuch der Website</h2>
      <p>Beim Abruf einer Seite verarbeitet der Hosting-Anbieter IP-Adresse, Zeitpunkt, abgerufene Adresse und Browserkennung, um die Seite auszuliefern und den Dienst zu schützen. Rechtsgrundlage: berechtigtes Interesse am sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).</p>

      <h2>Cookies und Speicher auf deinem Gerät</h2>
      <ProseTable
        head={["Was", "Zweck", "Wann", "Dauer"]}
        rows={[
          [<>Sitzungs-Cookies (<code>sb-…</code>)</>, <>Halten dich angemeldet</>, <>Nach der Anmeldung</>, <>Bis zur Abmeldung oder zum Ablauf der Sitzung</>],
          [<><code>pwn_next</code></>, <>Merkt sich die Seite, zu der du nach der Anmeldung zurückkehrst</>, <>Wenn du die Anmeldung startest</>, <>15 Minuten oder bis du angemeldet bist</>],
          [<><code>pwn_locale</code></>, <>Merkt sich die gewählte Sprache</>, <>Wenn du die Sprache wechselst oder im Profil speicherst</>, <>Ein Jahr</>],
          [<>Lokaler Speicher: Vergleich</>, <>Merkt sich die zum Vergleich gewählten Apps</>, <>Wenn du eine App zum Vergleich hinzufügst</>, <>Bis du ihn leerst</>],
          [<>Lokaler Speicher: Rezensionsentwurf</>, <>Bewahrt den Text einer Rezension, die du gerade schreibst</>, <>Während du eine Rezension schreibst</>, <>24 Stunden oder bis zur Veröffentlichung</>],
          [<>Cache des Service Workers</>, <>Hält statische Dateien dieser Website und die Offline-Seite vor, damit Seiten schneller laden und ohne Verbindung ein Hinweis erscheinen kann. Er enthält nur Dateien der Website, nichts über dich.</>, <>Beim ersten Besuch, in Browsern, die das unterstützen</>, <>Bis eine neue Version der Website ihn ersetzt</>],
        ]}
      />
      <p>Die Cookies und der lokale Speicher sind für eine Funktion erforderlich, die du angefordert hast. Nichts in dieser Liste dient der Werbung oder dazu, dich über Websites hinweg wiederzuerkennen. Deshalb gibt es kein Einwilligungsbanner.</p>

      <h2>Statistik</h2>
      <p>PWANova zählt je Produkt Profilaufrufe, Besuche der Produkt-Website, gespeicherte Einträge und ähnliche Aktionen. Ein Ereignis enthält das Produkt, die Art der Aktion, die Herkunft (zum Beispiel „Suche“ oder „direkt“), die Sprachausgabe und – wenn du angemeldet bist – dein Konto. Eine IP-Adresse enthält es nicht. Damit dieselbe Aktion nicht doppelt gezählt wird, hält der Server höchstens einen Tag lang einen Hashwert der IP-Adresse vor, der mit einem täglich wechselnden Zusatz gebildet wird. Rohdaten werden nach 180 Tagen gelöscht. Rechtsgrundlage: berechtigtes Interesse an der Messung der Nutzung des Katalogs (Art. 6 Abs. 1 lit. f DSGVO).</p>

      <h2>Konto</h2>
      <p>Für die Anmeldung verarbeiten wir deine E-Mail-Adresse und – bei Anmeldung über einen Anbieter wie GitHub oder Google – die Kennung, den Namen und das Profilbild, die dieser Anbieter übermittelt. Dein Profil zeigt Name, Profilbild, Kurztext und Website, die du einträgst. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).</p>

      <h2>Rezensionen, Bewertungen und Meldungen</h2>
      <p>Rezensionen und Bewertungen werden mit deinem Anzeigenamen veröffentlicht. Du kannst sie jederzeit bearbeiten oder löschen. Meldungen sind nur für Moderatoren sichtbar.</p>

      <h2>Einträge und Nachweise</h2>
      <p>Angaben, die du zu einem Produkt einreichst, werden mit ihrer Herkunft veröffentlicht (zum Beispiel „Angabe des Anbieters“). Der Verlauf der Nachweise bleibt erhalten, denn sichtbar zu machen, was sich geändert hat, ist der Zweck der Sammlung.</p>

      <h2>Software-Anfragen</h2>
      <p>Die Anforderungen einer Anfrage können passenden Anbietern oder – wenn du „öffentlich“ wählst – allen angezeigt werden. Sie dürfen keine personenbezogenen Daten enthalten. Kontaktdaten liegen in einer eigenen Tabelle, die nur du lesen kannst. An einen Anbieter gehen sie erst, nachdem du für diesen Anbieter eingewilligt hast; der Wortlaut der Einwilligung, die Felder und der Zeitpunkt werden festgehalten. Die Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Kontaktdaten werden nie verkauft und sind nicht Teil eines bezahlten Tarifs.</p>

      <h2>Newsletter</h2>
      <p>Wenn du den Newsletter abonnierst, speichern wir deine E-Mail-Adresse, die Sprache, den Zeitpunkt und den Wortlaut deiner Einwilligung. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du kannst dich jederzeit abmelden. Bisher wurde kein Newsletter versendet; vor der ersten Ausgabe wird der Versanddienst hier genannt.</p>

      <h2>Prüfung von Produkt-Websites</h2>
      <p>PWANova ruft öffentliche Seiten gelisteter Produkte ab. Personenbezogene Daten der Besucher dieser Websites werden dabei nicht verarbeitet.</p>

      <h2>Auftragsverarbeiter</h2>
      <ProseTable
        head={["Dienst", "Zweck", "Ort"]}
        rows={[
          [<>Vercel Inc.</>, <>Hosting und Auslieferung der Website; Serverfunktionen laufen in Frankfurt (fra1)</>, <><Missing>vom Betreiber zu bestätigen</Missing></>],
          [<>Supabase Inc.</>, <>Datenbank, Anmeldung, Dateispeicher</>, <><Missing>Region vom Betreiber zu bestätigen</Missing></>],
        ]}
      />
      <p><Missing>Vom Betreiber zu ergänzen: Auftragsverarbeitungsverträge, Region der Datenbank und die Garantien für Übermittlungen in ein Drittland.</Missing></p>

      <h2>Deine Rechte</h2>
      <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine Einwilligung kannst du jederzeit widerrufen. Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren.</p>
      <p>Um dein Konto und die damit verbundenen Daten zu löschen, schreibe an die oben genannte Kontaktadresse.</p>
    </>
  )
}

export function TermsContent({ locale }: { locale: Locale }) {
  const de = locale === "de"
  const sections: { title: string; body: React.ReactNode }[] = de ? [
    { title: "1. Worum es geht", body: <p>PWANova ist ein Katalog für Web-, KI- und PWA-Anwendungen. PWANova dokumentiert Nachweise zu Produkten und zeigt, woher sie stammen. PWANova ist keine Zertifizierungsstelle, leistet keine Rechtsberatung und ist nicht Vertragspartner, wenn du ein gelistetes Produkt nutzt oder kaufst.</p> },
    { title: "2. Konto", body: <p>Für Rezensionen, gespeicherte Einträge, Anfragen und das Einreichen von Apps brauchst du ein Konto. Du bist für dein Konto verantwortlich. Ein Konto pro Person.</p> },
    { title: "3. Einträge und Angaben von Anbietern", body: <ul><li>Wer eine App einreicht oder beansprucht, versichert, dazu berechtigt zu sein.</li><li>Angaben müssen zutreffen und belegbar sein. Eine Quelle ist anzugeben, wo eine verlangt wird.</li><li>Angaben werden mit ihrer Herkunft veröffentlicht. Der Verlauf bleibt sichtbar, auch wenn eine Angabe zurückgezogen wird.</li><li>PWANova darf Einträge ablehnen, ausblenden oder zusammenführen, wenn sie gegen diese Bedingungen verstoßen oder doppelt sind.</li></ul> },
    { title: "4. Rezensionen", body: <p>Es gelten die <Link href="/review-rules">Regeln für Bewertungen</Link>. Du räumst PWANova das einfache Recht ein, deine Rezension auf PWANova und in den Einbettungen von PWANova anzuzeigen, solange du sie nicht löschst.</p> },
    { title: "5. Software-Anfragen", body: <p>Anfragen dürfen in Titel und Beschreibung keine Kontaktdaten enthalten. Anbieter dürfen freigegebene Kontaktdaten nur für die Beantwortung der jeweiligen Anfrage verwenden.</p> },
    { title: "6. Was nicht erlaubt ist", body: <ul><li>Falsche Angaben, gekaufte oder gefälschte Rezensionen, das Manipulieren von Rankings.</li><li>Automatisiertes Auslesen jenseits der öffentlichen API und ihrer Grenzen.</li><li>Das Einreichen von Schadsoftware oder rechtswidrigen Inhalten.</li></ul> },
    { title: "7. Bezahlte Leistungen", body: <p>Der Basiseintrag ist kostenlos. Bezahlte Tarife sind angekündigt und derzeit nicht bestellbar. Werden sie eingeführt, gelten dafür gesonderte Bedingungen. Bezahlte Leistungen beeinflussen die organische Reihenfolge nicht.</p> },
    { title: "8. Verfügbarkeit und Haftung", body: <p>PWANova wird mit Sorgfalt betrieben, aber ohne Zusage einer bestimmten Verfügbarkeit. Für Angaben Dritter und für gelistete Produkte wird keine Gewähr übernommen. Die Haftung für Vorsatz und grobe Fahrlässigkeit sowie für Schäden an Leben, Körper und Gesundheit bleibt unberührt.</p> },
    { title: "9. Änderungen und Beendigung", body: <p>Du kannst dein Konto jederzeit löschen lassen. PWANova kann Konten sperren, die gegen diese Bedingungen verstoßen. Änderungen dieser Bedingungen werden auf dieser Seite mit Datum veröffentlicht.</p> },
  ] : [
    { title: "1. What this is", body: <p>PWANova is a catalogue of web, AI and PWA applications. It records evidence about products and shows where it comes from. PWANova is not a certification body, does not give legal advice, and is not a party to the contract when you use or buy a listed product.</p> },
    { title: "2. Account", body: <p>You need an account to write reviews, save listings, create requests and submit apps. You are responsible for your account. One account per person.</p> },
    { title: "3. Listings and vendor statements", body: <ul><li>Whoever submits or claims an app confirms that they are entitled to do so.</li><li>Statements have to be true and supportable. A source has to be given where one is asked for.</li><li>Statements are published with their origin. The history stays visible, also when a statement is withdrawn.</li><li>PWANova may reject, hide or merge listings that break these terms or are duplicates.</li></ul> },
    { title: "4. Reviews", body: <p>The <Link href="/review-rules">review rules</Link> apply. You grant PWANova the non-exclusive right to show your review on PWANova and in PWANova’s embeds for as long as you do not delete it.</p> },
    { title: "5. Software requests", body: <p>The title and the description of a request must not contain contact details. Vendors may use shared contact details only to answer the request they were shared for.</p> },
    { title: "6. What is not allowed", body: <ul><li>False statements, bought or fake reviews, manipulating rankings.</li><li>Automated extraction beyond the public API and its limits.</li><li>Submitting malware or unlawful content.</li></ul> },
    { title: "7. Paid services", body: <p>The basic listing is free. Paid plans are announced and cannot be ordered at the moment. When they are introduced, separate terms will apply to them. Paid services do not influence the organic order.</p> },
    { title: "8. Availability and liability", body: <p>PWANova is operated with care but without a promise of a particular availability. No guarantee is given for information provided by third parties or for listed products. Liability for intent and gross negligence and for injury to life, body and health remains unaffected.</p> },
    { title: "9. Changes and termination", body: <p>You can have your account deleted at any time. PWANova may suspend accounts that break these terms. Changes to these terms are published on this page with their date.</p> },
  ]
  return <>{sections.map((s) => <section key={s.title}><h2>{s.title}</h2>{s.body}</section>)}</>
}

/** The date the templates were last changed. Shown on the pages; changed by hand together with the text. */
export const LEGAL_UPDATED = "2026-09-29"

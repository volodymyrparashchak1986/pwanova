import type { Locale } from "@/i18n/config"

export function ReviewRulesContent({ locale }: { locale: Locale }) {
  return locale === "de" ? <German /> : <English />
}

function English() {
  return (
    <>
      <p>Reviews on PWANova are written by signed-in people about products they used. Nothing is written by PWANova and nothing is bought.</p>
      <h2>What a review should be</h2>
      <ul>
        <li>Your own experience with the product: what you used it for and how it went.</li>
        <li>Honest. Negative feedback is welcome. A low rating alone is never a reason to remove a review.</li>
        <li>Understandable to somebody who does not know the product yet.</li>
      </ul>
      <h2>What is not allowed</h2>
      <ul>
        <li>Reviews of your own product, or reviews written for payment or another advantage without saying so.</li>
        <li>Spam, copied reviews, several accounts for one person.</li>
        <li>Impersonation, threats, insults, discrimination.</li>
        <li>Personal data of other people: names, addresses, phone numbers, e-mail addresses.</li>
        <li>Statements of fact about a company that you cannot support.</li>
      </ul>
      <h2>How ratings count</h2>
      <ul>
        <li>One rating per person and product counts towards the average.</li>
        <li>You can change your rating, edit your review, delete the text and keep the rating, or remove the rating and keep the text.</li>
        <li>Owners cannot rate their own product. Their replies are labelled as the maker’s response.</li>
      </ul>
      <h2>What “registered user” means</h2>
      <p>A review comes from a signed-in account. PWANova does not verify that the reviewer is a customer of the product, and does not claim so.</p>
      <h2>Reporting and moderation</h2>
      <ul>
        <li>Every review has a report link. Every report is read by a moderator.</li>
        <li>A moderator may hide a review that breaks these rules. The reason is recorded, and the author sees it.</li>
        <li>Owners can reply to a review. They cannot remove it.</li>
        <li>Removing a review is never part of a paid plan.</li>
      </ul>
    </>
  )
}

function German() {
  return (
    <>
      <p>Rezensionen bei PWANova schreiben angemeldete Personen über Produkte, die sie genutzt haben. PWANova schreibt keine Rezensionen, und keine ist gekauft.</p>
      <h2>Was eine Rezension sein soll</h2>
      <ul>
        <li>Deine eigene Erfahrung mit dem Produkt: wofür du es genutzt hast und wie es lief.</li>
        <li>Ehrlich. Kritik ist willkommen. Eine niedrige Bewertung allein ist nie ein Grund, eine Rezension zu entfernen.</li>
        <li>Verständlich für jemanden, der das Produkt noch nicht kennt.</li>
      </ul>
      <h2>Was nicht erlaubt ist</h2>
      <ul>
        <li>Rezensionen zum eigenen Produkt sowie Rezensionen gegen Bezahlung oder einen anderen Vorteil, ohne das offenzulegen.</li>
        <li>Spam, kopierte Rezensionen, mehrere Konten einer Person.</li>
        <li>Identitätsmissbrauch, Drohungen, Beleidigungen, Diskriminierung.</li>
        <li>Personenbezogene Daten anderer: Namen, Adressen, Telefonnummern, E-Mail-Adressen.</li>
        <li>Tatsachenbehauptungen über ein Unternehmen, die du nicht belegen kannst.</li>
      </ul>
      <h2>Wie Bewertungen zählen</h2>
      <ul>
        <li>Pro Person und Produkt zählt eine Bewertung für den Durchschnitt.</li>
        <li>Du kannst deine Bewertung ändern, deine Rezension bearbeiten, den Text löschen und die Bewertung behalten oder die Bewertung entfernen und den Text behalten.</li>
        <li>Inhaber können ihr eigenes Produkt nicht bewerten. Ihre Antworten sind als Antwort des Anbieters gekennzeichnet.</li>
      </ul>
      <h2>Was „registrierter Nutzer“ bedeutet</h2>
      <p>Eine Rezension stammt von einem angemeldeten Konto. PWANova prüft nicht, ob die Person Kunde des Produkts ist, und behauptet das auch nicht.</p>
      <h2>Melden und Moderation</h2>
      <ul>
        <li>Jede Rezension hat einen Link zum Melden. Jede Meldung wird von einem Moderator gelesen.</li>
        <li>Ein Moderator kann eine Rezension ausblenden, die gegen diese Regeln verstößt. Der Grund wird festgehalten und ist für den Autor sichtbar.</li>
        <li>Inhaber können auf eine Rezension antworten. Entfernen können sie sie nicht.</li>
        <li>Das Entfernen einer Rezension ist nie Teil eines bezahlten Tarifs.</li>
      </ul>
    </>
  )
}

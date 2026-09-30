import "server-only"
import { cookies, headers } from "next/headers"
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, splitLocale, type Locale } from "@/i18n/config"

/**
 * Messages returned by server actions. A server action has no `[locale]` segment: the language is the
 * one of the page the action was sent from, then a language the person picked, then the default.
 */
const MESSAGES = {
  en: {
    signIn: "Please sign in to continue.",
    tooFast: "You're doing that too fast. Please try again in a bit.",
    invalid: "Please check your input.",
    notFound: "We couldn't find that.",
    notAllowed: "You are not allowed to do that.",
    failed: "That did not work. Please try again.",
    needsDatabase: "This feature needs a configured database connection.",
    email: "Enter a valid e-mail address.",
    consent: "Please confirm the consent.",
    ownApp: "You can only do this for apps you manage.",
    verifiedOwnerOnly: "Only the verified owner of an app can do this.",
    compareMax: "A comparison holds up to four apps.",
    compareMin: "Add at least two apps to compare.",
    contactInText: "Please remove e-mail addresses and phone numbers from the title and the description. Contact details belong in the contact section.",
    reasonRequired: "Please give a reason. It is recorded in the audit log.",
    launchExists: "This app already has a launch in progress.",
    recheckLimit: "A re-check can be requested three times a day.",
    sourceRequired: "A public source URL is required for this statement.",
    saved: "Saved.",
    done: "Done.",
    notEntitled: "This is part of a plan that is not active for this app.",
    featureOff: "This feature is switched off at the moment.",
    alreadyResponded: "You have already responded to this request.",
    duplicate: "This app is already listed. You can claim it instead.",
    ratingRange: "Choose 1 to 5 stars.",
    ownRate: "You cannot rate your own app.",
    ownReview: "You cannot review your own app.",
    ownVote: "You cannot vote on your own review.",
    reviewShort: "Write at least 10 characters.",
    reviewLimit: "Too many reviews. Please try again later.",
    reviewPosted: "Review posted.",
    reviewUpdated: "Review updated.",
    reviewDeleted: "Review text deleted. Your rating is unchanged.",
    ratingRemoved: "Rating removed. Your review text is unchanged.",
    ratingSaved: "Thank you for rating.",
    reportThanks: "Thank you. A moderator will take a look.",
    responsePosted: "Response posted.",
    responseShort: "Write a response first.",
    respondOwnerOnly: "Only the verified owner of the reviewed app can respond.",
    submitLimit: "You have submitted too many apps today.",
    urlInvalid: "Enter a valid public URL.",
    claimFirst: "Start a claim first.",
    claimOwned: "This app already has a verified owner.",
    claimExpired: "This token has expired. Start the claim again to get a fresh one.",
    claimNotFound: "The verification file was not found or its content does not match.",
    claimVerified: "Ownership verified.",
    claimHttps: "Ownership verification requires an HTTPS address.",
    checksUpdated: "Checks updated.",
    serverKey: "This needs the server-side service key, which is not configured.",
    analysisLimit: "The daily analysis limit is reached.",
  },
  de: {
    signIn: "Bitte melde dich an, um fortzufahren.",
    tooFast: "Das war zu schnell. Bitte versuche es gleich noch einmal.",
    invalid: "Bitte prüfe deine Eingaben.",
    notFound: "Das konnten wir nicht finden.",
    notAllowed: "Das ist dir nicht erlaubt.",
    failed: "Das hat nicht funktioniert. Bitte versuche es noch einmal.",
    needsDatabase: "Diese Funktion braucht eine eingerichtete Datenbankverbindung.",
    email: "Gib eine gültige E-Mail-Adresse ein.",
    consent: "Bitte bestätige die Einwilligung.",
    ownApp: "Das geht nur bei Apps, die du verwaltest.",
    verifiedOwnerOnly: "Das kann nur der verifizierte Inhaber einer App.",
    compareMax: "Ein Vergleich enthält höchstens vier Apps.",
    compareMin: "Füge mindestens zwei Apps zum Vergleich hinzu.",
    contactInText: "Bitte entferne E-Mail-Adressen und Telefonnummern aus Titel und Beschreibung. Kontaktdaten gehören in den Kontaktbereich.",
    reasonRequired: "Bitte gib einen Grund an. Er wird im Audit-Log festgehalten.",
    launchExists: "Für diese App läuft bereits ein Launch.",
    recheckLimit: "Eine erneute Prüfung kann dreimal pro Tag angefordert werden.",
    sourceRequired: "Für diese Angabe ist eine öffentliche Quell-URL nötig.",
    saved: "Gespeichert.",
    done: "Erledigt.",
    notEntitled: "Das gehört zu einem Tarif, der für diese App nicht aktiv ist.",
    featureOff: "Diese Funktion ist im Moment abgeschaltet.",
    alreadyResponded: "Du hast auf diese Anfrage bereits reagiert.",
    duplicate: "Diese App ist bereits gelistet. Du kannst den Eintrag stattdessen beanspruchen.",
    ratingRange: "Wähle 1 bis 5 Sterne.",
    ownRate: "Deine eigene App kannst du nicht bewerten.",
    ownReview: "Deine eigene App kannst du nicht rezensieren.",
    ownVote: "Deine eigene Rezension kannst du nicht bewerten.",
    reviewShort: "Schreibe mindestens 10 Zeichen.",
    reviewLimit: "Zu viele Rezensionen. Bitte versuche es später noch einmal.",
    reviewPosted: "Rezension veröffentlicht.",
    reviewUpdated: "Rezension aktualisiert.",
    reviewDeleted: "Rezensionstext gelöscht. Deine Bewertung bleibt bestehen.",
    ratingRemoved: "Bewertung entfernt. Dein Rezensionstext bleibt bestehen.",
    ratingSaved: "Danke für deine Bewertung.",
    reportThanks: "Danke. Ein Moderator sieht sich das an.",
    responsePosted: "Antwort veröffentlicht.",
    responseShort: "Schreibe zuerst eine Antwort.",
    respondOwnerOnly: "Antworten kann nur der verifizierte Inhaber der rezensierten App.",
    submitLimit: "Du hast heute zu viele Apps eingereicht.",
    urlInvalid: "Gib eine gültige öffentliche URL ein.",
    claimFirst: "Starte zuerst die Beanspruchung.",
    claimOwned: "Diese App hat bereits einen verifizierten Inhaber.",
    claimExpired: "Dieses Token ist abgelaufen. Starte die Beanspruchung erneut, um ein neues zu erhalten.",
    claimNotFound: "Die Verifizierungsdatei wurde nicht gefunden oder ihr Inhalt stimmt nicht überein.",
    claimVerified: "Inhaberschaft verifiziert.",
    claimHttps: "Für die Verifizierung der Inhaberschaft ist eine HTTPS-Adresse nötig.",
    checksUpdated: "Prüfungen aktualisiert.",
    serverKey: "Dafür wird der serverseitige Dienstschlüssel benötigt, der nicht eingerichtet ist.",
    analysisLimit: "Das Tageslimit für Analysen ist erreicht.",
  },
} as const satisfies Record<Locale, Record<string, string>>

export type MessageKey = keyof (typeof MESSAGES)["en"]

export async function actionLocale(): Promise<Locale> {
  try {
    const referer = (await headers()).get("referer")
    const fromPage = referer ? splitLocale(new URL(referer).pathname).locale : null
    if (fromPage) return fromPage
  } catch { /* no usable referer */ }
  const value = (await cookies()).get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export async function msg(key: MessageKey): Promise<string> {
  return MESSAGES[await actionLocale()][key]
}

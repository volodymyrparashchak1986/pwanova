/** Choices offered in forms. Names come from Intl, so every language gets them without a translation table. */

/** ISO 3166-1 alpha-2. EU member states first in the list that forms show, then everything else by name. */
export const EU_COUNTRIES = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"] as const
export const COUNTRIES = [
  ...EU_COUNTRIES, "CH", "GB", "NO", "IS", "LI", "US", "CA", "AU", "NZ", "JP", "KR", "SG", "IN", "IL", "AE", "BR", "MX", "AR", "CL", "CO", "ZA", "NG", "KE", "EG", "MA", "TR", "UA",
  "RS", "BA", "ME", "MK", "AL", "XK", "MD", "GE", "AM", "AZ", "KZ", "UZ", "CN", "HK", "TW", "TH", "VN", "MY", "ID", "PH", "PK", "BD", "LK", "NP", "SA", "QA", "KW", "BH", "OM", "JO",
  "LB", "TN", "DZ", "GH", "SN", "CI", "ET", "TZ", "UG", "RW", "PE", "EC", "UY", "PY", "BO", "VE", "CR", "PA", "DO", "GT", "PR", "JM", "TT", "MU", "AD", "MC", "SM", "VA", "GI", "JE", "GG", "IM", "FO", "GL",
] as const

export const isEuCountry = (code: string | null | undefined) => Boolean(code) && (EU_COUNTRIES as readonly string[]).includes(code!.toUpperCase())

/** ISO 639-1 codes of languages a product is commonly offered in. */
export const LANGUAGES = ["en", "de", "fr", "es", "it", "nl", "pl", "pt", "sv", "da", "fi", "nb", "cs", "sk", "hu", "ro", "bg", "hr", "sl", "el", "et", "lv", "lt", "tr", "uk", "ru", "ja", "zh", "ko", "ar", "he", "hi"] as const

export const PRICING_MODELS = ["unknown", "free", "freemium", "subscription", "one_time", "usage_based", "open_source", "contact_sales"] as const
export const MAKER_PLATFORMS = ["ios", "android", "macos", "windows", "linux", "browser_extension"] as const
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const
export const REGIONS = ["eu", "eea", "de", "ch", "uk", "us", "global", "other"] as const

/** Capabilities a maker can state about a product. Documents are stated through their address instead. */
export const STATEABLE_CAPABILITIES = ["api_available", "mcp_available", "open_source", "self_hosted", "offline_capable", "sso", "ai_used", "eu_hosting_available", "no_training_on_customer_data"] as const

/**
 * Facts nobody states by hand: they follow from the company record, or they are technical observations
 * that PWANova makes at one address and that a statement could only contradict.
 */
export const NOT_STATEABLE = ["eu_company", "company_identified", "company_country", "website_reachable", "https", "pwa_manifest", "security_txt"] as const

/** Facts a buyer can require in a request. */
export const REQUESTABLE_FACTS = ["eu_company", "eu_hosting_available", "dpa_available", "subprocessors_published", "no_training_on_customer_data", "privacy_policy", "legal_notice", "open_source", "self_hosted", "api_available", "mcp_available", "sso", "pwa_manifest", "offline_capable", "german_available", "free_plan"] as const

/** Which form field a discovered document fills. */
export const DOCUMENT_FIELDS = {
  privacy_policy: "privacyUrl", legal_notice: "legalUrl", dpa_available: "dpaUrl", subprocessors_published: "subprocessorsUrl",
  pricing_page: "pricingUrl", source_repository: "githubUrl", api_docs: "apiDocsUrl", mcp_available: "mcpDocsUrl",
} as const
export type DocumentField = (typeof DOCUMENT_FIELDS)[keyof typeof DOCUMENT_FIELDS]

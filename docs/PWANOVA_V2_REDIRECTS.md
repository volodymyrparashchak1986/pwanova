# PWANova V2 — addresses and redirects

Every address of version 1 either still answers or redirects to where the page lives now. Links on
other sites, badges, embeds and entries in search engines keep working.

Code: `src/proxy.ts`, `src/i18n/config.ts` (`legacyTarget`, `LEGACY_CATEGORY_SLUGS`),
`src/lib/v2/params.ts`. Test: "every page lives under a language; old addresses arrive where the
page is now" in `tests/e2e/v2.spec.ts`, and "language editions" in `tests/v2-unit.test.ts`.

## 1. Language

| Request | Answer |
| --- | --- |
| an address without a language, for example `/`, `/apps/habitloop`, `/discover?q=crm` | **307** to the same address under `/en` or `/de`, with the query unchanged |
| an address with a language | the page |

Which language: the language the visitor picked earlier (`pwn_locale`), otherwise the best match of
`Accept-Language`, otherwise English. The redirect is temporary (307) because it depends on the
visitor. It sets no cookie.

Search engines get `hreflang` for `en`, `de` and `x-default` (English) on every indexable page, and
the sitemap lists both editions.

## 2. Pages that moved

Permanent (308) when the address already has a language; the language redirect (307) and the move
happen in one step when it has none.

| Version 1 | V2 |
| --- | --- |
| `/explore` | `/discover` |
| `/top` | `/discover?sort=rating` |
| `/trending` | `/discover?sort=trending` |
| `/new` | `/discover?sort=new` |
| `/ship` | `/submit` |
| `/for-developers` | `/for-makers` |
| `/activity` | `/notifications` |

The query of the request is kept: `/explore?q=invoice` arrives at `/en/discover?q=invoice`.

## 3. Categories that were renamed

| Version 1 | V2 |
| --- | --- |
| `/categories/ai` | `/categories/ai-assistants` |
| `/categories/business` | `/categories/business-operations` |
| `/categories/fitness`, `/categories/health` | `/categories/health-fitness` |
| `/categories/social` | `/categories/communication` |
| `/categories/entertainment`, `/categories/games` | `/categories/media-entertainment` |
| `/categories/travel`, `/categories/food` | `/categories/lifestyle` |

`productivity`, `finance`, `education`, `developer-tools`, `lifestyle`, `utilities` and `other` kept
their slug.

## 4. Parameters of the catalogue

`/discover` redirects (308) to the canonical form when it gets a parameter of version 1.

| Version 1 | V2 | Meaning |
| --- | --- | --- |
| `?verified=1` | `?owner=1` | ownership verified. It never meant that the product was checked |
| `?pwa=1` | `?fact=pwa_manifest` | a web app manifest was found |
| `?sort=top` | no parameter | the default order |
| `?category=fitness` | `?category=health-fitness` | renamed categories |

Example: `/explore?verified=1&pwa=1&sort=top&category=fitness` arrives at
`/en/discover?category=health-fitness&fact=pwa_manifest&owner=1`.

Parameters are written in one fixed order, so equal filters have equal addresses.

## 5. Comparisons

| Request | Answer |
| --- | --- |
| `/compare?apps=b,a` | 308 to `/compare/a-vs-b` |
| `/compare/b-vs-a` | 308 to `/compare/a-vs-b` (alphabetical order is canonical) |
| more than four apps | 308 to the first four in alphabetical order |
| an app in the address is not a public listing | it is left out; the address is corrected (308) |
| fewer than two public apps remain | 308 to `/compare`, which keeps the selection |
| no public app in the address | 404 |

## 6. Listings

| Case | Answer |
| --- | --- |
| a listing keeps its slug | same address under the language |
| a duplicate that was merged into another listing | 308 to the listing that stayed; the API answers 301 with the new address |
| a listing that is hidden, suspended, rejected or waiting for review | 404 on the page, the evidence page, comparisons, the API, the badge and the embed |
| `#install`, `#reviews`, `#trust` | anchors on the listing page; `#install` opens the install guidance |

## 7. Addresses without a language

These exist once and are not redirected:

| Address | Note |
| --- | --- |
| `/api/v1/*` | public API; `?lang=` selects the language of the answer |
| `/api/public/apps/by-domain` | endpoint of version 1, unchanged response |
| `/api/badge/{slug}` | unchanged; `?lang=de` for German text |
| `/embed/app/{slug}` | unchanged; `?lang=`, `?theme=`, `?ref=` |
| `/api/events`, `/api/media`, `/api/cron/*` | internal |
| `/auth/callback`, `/auth/sign-out` | sign-in |
| `/offline` | one page in both languages, cached by the service worker |
| `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/sw.js`, icons, `/.well-known/*` | static |

Links inside a badge or an embed point to the listing under the language of the badge.

## 8. Signing in

| Request | Answer |
| --- | --- |
| `/?code=…` or `/en?code=…` (a sign-in link that was sent back to the start page) | 307 to `/auth/callback?code=…` |
| `/auth/callback` | completes the sign-in and continues to the page stored in `pwn_next`, otherwise to the start page in the language of the profile |
| `/sign-in?next=/de/dashboard` | `next` is accepted when it is a path on this site |

The address that is registered with Supabase is exactly `<site>/auth/callback`, without parameters.

## 9. Not found

| Request | Answer |
| --- | --- |
| an unknown page under a language | 404 page in that language |
| `/collections/<unknown>`, `/categories/<unknown>` | 404. Names such as `constructor` or `__proto__` are unknown names |
| an unknown language, for example `/fr/discover` | treated as an address without a language: 307 to `/en/fr/discover`, which is a 404 |

## 10. Search engines

- Canonical addresses always contain the language.
- Catalogue pages with a search text, a filter, a sort order or a page number are `noindex, follow`.
- Comparisons of two listed products are indexable, comparisons of three or four are not.
- Private pages (dashboard, saved, notifications, profile, sign-in, claim, requests of a person,
  admin) are `noindex` and are not in the sitemap.
- Sample listings are never indexed.
- Nothing is indexed at all unless `ALLOW_INDEXING=true`.

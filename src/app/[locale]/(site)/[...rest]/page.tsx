import { notFound } from "next/navigation"

/** Anything that is not a page renders the localized not-found page instead of the framework default. */
export default function CatchAll() {
  notFound()
}

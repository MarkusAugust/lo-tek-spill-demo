import type { APIRoute } from "astro"

import { settKapsel, slettGammelForm } from "../lib/kapsel"
import { KAPSEL } from "../lib/lotek"
import { bliMed, erTest } from "../lib/spilltjener"

export const prerender = false

/**
 * Skjemaet for å bli med.
 *
 * En vanlig POST med en omdirigering tilbake, altså mønsteret som har virket
 * siden før JavaScript. Kapselen må stå før hendelsesstrømmen åpnes, ellers
 * vet serveren ikke hvem som sitter der.
 */
export const POST: APIRoute = async ({ request }) => {
  const skjema = await request.formData()
  const navn = String(skjema.get("navn") ?? "")

  /*
   * Hodene skrives her og ikke med `cookies.set`: kapselen settes, og den
   * gamle formen uten `Partitioned` slettes, og Astro sender bare én
   * `Set-Cookie` per navn. Merkene står i `lib/kapsel.ts`.
   */
  const hoder = new Headers({ location: "/" })
  try {
    const spiller = await bliMed(navn, erTest(request))
    hoder.append("set-cookie", slettGammelForm(KAPSEL))
    hoder.append("set-cookie", settKapsel(KAPSEL, spiller.spillerId, 8 * 60 * 60, { httpOnly: true }))
  } catch {
    // Spilltjeneren er nede. Forsiden sier fra om det, så vi sender deg dit.
  }

  return new Response(null, { status: 303, headers: hoder })
}

import type { APIRoute } from "astro"

import { slettKapsel } from "../lib/kapsel"
import { KAPSEL } from "../lib/lotek"
import { gaAv } from "../lib/spilltjener"

export const prerender = false

/**
 * Går av vakt, og blir borte fra tavla med en gang.
 *
 * Ingen knapp peker hit. Paritetstesten bruker den for å rydde etter seg, og
 * det er det samme kallet en «gå av vakt»-knapp ville gjort.
 */
export const POST: APIRoute = async ({ cookies }) => {
  const spillerId = cookies.get(KAPSEL)?.value
  if (spillerId) await gaAv(spillerId).catch(() => {})
  // Begge formene, med de samme merkene de ble satt med. Se `lib/kapsel.ts`.
  const hoder = new Headers()
  for (const k of slettKapsel(KAPSEL)) hoder.append("set-cookie", k)
  return new Response("ok", { headers: hoder })
}

import type { APIRoute } from "astro"

import { erOppe } from "../lib/spilltjener"

export const prerender = false

/** Ventesiden spør her, en gang i sekundet, og går videre når svaret er ja. */
export const GET: APIRoute = async () =>
  (await erOppe()) ? new Response("ja") : new Response("nei", { status: 503 })

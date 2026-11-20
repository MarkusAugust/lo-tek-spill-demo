import type { APIRoute } from "astro"

import { LOTEK_CSS } from "../lib/venteside"

export const prerender = false

/** LO-TEK som ett stilark, til ventesiden. Se `lib/venteside.ts`. */
export const GET: APIRoute = () =>
  new Response(LOTEK_CSS, { headers: { "content-type": "text/css" } })

import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

/**
 * Ventesiden, samme fil som de to andre appene viser.
 *
 * Den er en vanlig HTML-fil og trenger en adresse til LO-TEK, siden resten
 * av appen får stilarkene gjennom bunteren. Den adressen er `/lotek.css`,
 * fra pakken appen allerede har, ikke fra CDN.
 */
export const VENTESIDE: string = readFileSync(
  process.env.VENTESIDE_FIL ?? "../../felles/venteside.html",
  "utf8",
).replaceAll("{{LOTEK_CSS}}", "/lotek.css")

/** LO-TEK som ett stilark, til ventesiden. */
export const LOTEK_CSS: string = readFileSync(
  createRequire(import.meta.url).resolve("@lo-tek/interfaces/lotek.css"),
  "utf8",
)

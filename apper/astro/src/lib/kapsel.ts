/**
 * Merkene hver kapsel skrives med, lokalt og i drift.
 *
 * I skallet står utgavene i rammer fra andre nettsteder. Der sendes en
 * kapsel bare når den er `SameSite=None; Secure`, og i Safari bare når den
 * også er `Partitioned`. Før sto `Lax` lokalt og `None` bak https, og de tre
 * appene avgjorde https hver på sin måte. Chromium og WebKit godtar `Secure`
 * på `http://localhost`, så det trengs ingen avgjørelse: merkene er de
 * samme overalt. Se «kapsel» i `GLOSSARY.md`.
 *
 * Regelen står også i Datastar-appen, i Kotlin, og `tester/kapsler.ts`
 * holder de tre i takt.
 */
export const KAPSELMERKER = "Path=/; SameSite=None; Secure; Partitioned"

/** En `Set-Cookie` som setter kapselen. */
export function settKapsel(
  navn: string,
  verdi: string,
  sekunder: number,
  { httpOnly = false }: { httpOnly?: boolean } = {},
): string {
  return `${navn}=${encodeURIComponent(verdi)}; Max-Age=${sekunder}; ${KAPSELMERKER}${httpOnly ? "; HttpOnly" : ""}`
}

/** Hver `Set-Cookie` som sletter kapselen, i begge formene. */
export function slettKapsel(navn: string): string[] {
  return [`${navn}=; Max-Age=0; ${KAPSELMERKER}`, slettGammelForm(navn)]
}

/**
 * Sletter kapselen slik den ble satt før 2026-11-19, uten `Partitioned`.
 *
 * En sletting treffer bare en kapsel med de samme merkene, og ligger den
 * gamle ved siden av den nye, kan den bli lest i stedet. Sendes derfor
 * også når kapselen settes på nytt. Kan fjernes når kapslene derfra har
 * gått ut: spillerkapselen etter åtte timer, temakapselen etter et år.
 */
export function slettGammelForm(navn: string): string {
  return `${navn}=; Max-Age=0; Path=/; SameSite=None; Secure`
}

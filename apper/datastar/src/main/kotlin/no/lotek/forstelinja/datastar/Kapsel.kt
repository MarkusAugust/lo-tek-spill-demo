package no.lotek.forstelinja.datastar

import io.ktor.http.HttpHeaders
import io.ktor.server.application.ApplicationCall
import java.net.URLEncoder

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
 * Regelen står også i de to TypeScript-appene, i `kapsel.ts`, og
 * `tester/kapsler.ts` holder de tre i takt.
 */
const val KAPSELMERKER = "Path=/; SameSite=None; Secure; Partitioned"

/**
 * Setter kapselen, og sletter den gamle formen først, så den ikke blir lest
 * i stedet for den nye.
 *
 * Hodet skrives selv: Ktors `Cookie` har ikke `Partitioned`, og to
 * `Set-Cookie` med samme navn må stå i rekkefølge.
 */
fun ApplicationCall.settKapsel(navn: String, verdi: String, sekunder: Int, httpOnly: Boolean = false) {
  response.headers.append(HttpHeaders.SetCookie, slettGammelForm(navn))
  val kodet = URLEncoder.encode(verdi, Charsets.UTF_8)
  response.headers.append(
    HttpHeaders.SetCookie,
    "$navn=$kodet; Max-Age=$sekunder; $KAPSELMERKER${if (httpOnly) "; HttpOnly" else ""}",
  )
}

/** Sletter kapselen i begge formene, med de samme merkene den ble satt med. */
fun ApplicationCall.slettKapsel(navn: String) {
  response.headers.append(HttpHeaders.SetCookie, "$navn=; Max-Age=0; $KAPSELMERKER")
  response.headers.append(HttpHeaders.SetCookie, slettGammelForm(navn))
}

/**
 * Sletter kapselen slik den ble satt før 2026-11-19, uten `Partitioned`.
 *
 * En sletting treffer bare en kapsel med de samme merkene. Kan fjernes når
 * kapslene derfra har gått ut: spillerkapselen etter åtte timer,
 * temakapselen etter et år.
 */
fun slettGammelForm(navn: String) = "$navn=; Max-Age=0; Path=/; SameSite=None; Secure"

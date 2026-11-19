package no.lotek.forstelinja.datastar

/** En feil som skal vises. `felt` er id-en i skjemaet, eller `null` for en feil uten felt. */
data class Feil(val felt: String?, val melding: String)

/**
 * Valideringen av vedtaket, gjort på serveren.
 *
 * Regelen for et helt svar eies av spilltjeneren, som avviser alt annet.
 * Valideringen her er hjelp ved feltet: den sier fra før svaret sendes, med
 * feilen ved feltet den gjelder. De tre appene gjør det hver for seg, slik
 * tre ekte apper ville gjort, og det er en del av sammenligningen.
 */
fun valider(
  vedtak: String?,
  hjemmel: String?,
  kommune: String?,
  felle: String?,
  kommuner: List<String>,
): List<Feil> =
  buildList {
    if (vedtak.isNullOrBlank()) {
      add(Feil("v-innvilget", "Du må velge om saken innvilges eller avslås"))
    }
    if (hjemmel.isNullOrBlank()) {
      add(Feil("hjemmel", "Du må oppgi hvilken hjemmel vedtaket bygger på"))
    }
    if (!kommune.isNullOrBlank() && kommune !in kommuner) {
      add(Feil("kommune", "«$kommune» er ikke en kommune. Slå den opp i lista."))
    }
    // «Nei, saken er i orden» er et svar, og tomt er ikke. Uten dette kunne
    // en spiller låse svar på et spørsmål hun aldri tok stilling til.
    if (felle.isNullOrBlank()) {
      add(Feil("felle", "Du må si om noe er feil i søknaden"))
    }
  }

/**
 * Avvisningen fra spilltjeneren, som feil i skjemaet.
 *
 * Spilltjeneren sier hvorfor med en verdi, og appen skriver teksten. En
 * avvisning uten felt, som at saken ikke ligger på bordet lenger, står
 * øverst i feiloppsummeringen uten lenke.
 */
fun feilFraAvvisning(kvittering: Kvittering): List<Feil> =
  when (kvittering.grunn) {
    "ufullstendig" -> kvittering.felt.map { feilVedFelt(it) }
    "feil_sak" -> listOf(Feil(null, "Saken du svarte på, ligger ikke på bordet lenger. Vedtaket ble ikke registrert."))
    "runden_er_over" -> listOf(Feil(null, "Runden var over før vedtaket kom fram. Det ble ikke registrert."))
    "alt_svart" -> listOf(Feil(null, "Vedtaket i denne saken er alt fattet."))
    "ukjent_spiller" -> listOf(Feil(null, "Spilltjeneren kjenner deg ikke. Meld deg på igjen."))
    else -> listOf(Feil(null, "Vedtaket ble ikke tatt imot. Prøv igjen."))
  }

private fun feilVedFelt(feltfeil: Feltfeil): Feil {
  val ukjent = feltfeil.feil == "ukjent"
  return when (feltfeil.felt) {
    "vedtak" -> Feil("v-innvilget", "Du må velge om saken innvilges eller avslås")
    "hjemmel" ->
      Feil("hjemmel", if (ukjent) "Hjemmelen finnes ikke. Velg en fra lista." else "Du må oppgi hvilken hjemmel vedtaket bygger på")
    "kommune" -> Feil("kommune", "Kommunen er ikke en kommune. Slå den opp i lista.")
    "felle" ->
      Feil("felle", if (ukjent) "Velg et av feltene i lista." else "Du må si om noe er feil i søknaden")
    else -> Feil(null, "Vedtaket ble ikke tatt imot. Prøv igjen.")
  }
}

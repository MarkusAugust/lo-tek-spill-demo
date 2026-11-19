import type { Feil, Kvittering } from "./tilstand"

/**
 * Valideringen av vedtaket, gjort på appserveren.
 *
 * Regelen for et helt svar eies av spilltjeneren, som avviser alt annet.
 * Valideringen her er hjelp ved feltet: den sier fra før svaret sendes, med
 * feilen ved feltet den gjelder. De tre appene gjør det hver for seg, slik
 * tre ekte apper ville gjort, og det er en del av sammenligningen.
 */
export function valider(
  vedtak: string | null,
  hjemmel: string | null,
  kommune: string | null,
  felle: string | null,
  kommuner: string[],
): Feil[] {
  const feil: Feil[] = []
  if (!vedtak) feil.push({ felt: "v-innvilget", melding: "Du må velge om saken innvilges eller avslås" })
  if (!hjemmel) feil.push({ felt: "hjemmel", melding: "Du må oppgi hvilken hjemmel vedtaket bygger på" })
  if (kommune && !kommuner.includes(kommune)) {
    feil.push({ felt: "kommune", melding: `«${kommune}» er ikke en kommune. Slå den opp i lista.` })
  }
  // «Nei, saken er i orden» er et svar, og tomt er ikke. Uten dette kunne en
  // spiller låse svar på et spørsmål hun aldri tok stilling til.
  if (!felle) feil.push({ felt: "felle", melding: "Du må si om noe er feil i søknaden" })
  return feil
}

/**
 * Avvisningen fra spilltjeneren, som feil i skjemaet.
 *
 * Spilltjeneren sier hvorfor med en verdi, og appen skriver teksten. En
 * avvisning uten felt, som at saken ikke ligger på bordet lenger, står
 * øverst i feiloppsummeringen uten lenke.
 */
export function feilFraAvvisning(kvittering: Kvittering): Feil[] {
  switch (kvittering.grunn) {
    case "ufullstendig":
      return kvittering.felt.map(feilVedFelt)
    case "feil_sak":
      return [{ felt: null, melding: "Saken du svarte på, ligger ikke på bordet lenger. Vedtaket ble ikke registrert." }]
    case "runden_er_over":
      return [{ felt: null, melding: "Runden var over før vedtaket kom fram. Det ble ikke registrert." }]
    case "alt_svart":
      return [{ felt: null, melding: "Vedtaket i denne saken er alt fattet." }]
    case "ukjent_spiller":
      return [{ felt: null, melding: "Spilltjeneren kjenner deg ikke. Meld deg på igjen." }]
    default:
      return [{ felt: null, melding: "Vedtaket ble ikke tatt imot. Prøv igjen." }]
  }
}

function feilVedFelt({ felt, feil }: Kvittering["felt"][number]): Feil {
  const ukjent = feil === "ukjent"
  switch (felt) {
    case "vedtak":
      return { felt: "v-innvilget", melding: "Du må velge om saken innvilges eller avslås" }
    case "hjemmel":
      return {
        felt: "hjemmel",
        melding: ukjent
          ? "Hjemmelen finnes ikke. Velg en fra lista."
          : "Du må oppgi hvilken hjemmel vedtaket bygger på",
      }
    case "kommune":
      return { felt: "kommune", melding: "Kommunen er ikke en kommune. Slå den opp i lista." }
    case "felle":
      return {
        felt: "felle",
        melding: ukjent ? "Velg et av feltene i lista." : "Du må si om noe er feil i søknaden",
      }
  }
}

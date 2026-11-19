# Ordliste

Ordene spillet bruker om seg selv, slik de står i koden og i det
spilltjeneren sender.

**Resultat**: hvordan saken gikk for én spiller, avgjort av spilltjeneren og
sendt som `meg.resultat`. Fem verdier:

- `full`: svaret ga full pott.
- `delvis`: svaret ga noen poeng, men ikke alle.
- `ingen`: svaret ga ingen poeng.
- `avvik`: spilleren var med på saken fra starten, men svarte ikke før
  runden var over.
- `sent`: spilleren meldte seg på midt i saken og svarte ikke. Det er ikke et
  avvik, fordi spilleren aldri hadde sjansen.

Resultatet er `null` mens runden går og spilleren ikke har svart. Det settes så
snart et svar er levert, og står alltid i oppgjøret. Appene velger selv
overskrift og farge for hvert resultat; spilltjeneren sender bare verdien.
Kvitteringen og resultatdialogen leser det samme feltet.

**Utfall**: vedtaksfeltet i skjemaet, innvilget eller avslått (`Vedtak` i
koden). Ikke det samme som resultatet: «Utfall» er det spilleren svarer,
«resultat» er hvordan svaret gikk.

**Avvisning**: et svar spilltjeneren ikke tar imot, med grunnen som verdi.
Appene skriver teksten og viser den i feiloppsummeringen.

- `runden_er_over`, `alt_svart`, `ukjent_spiller` og `feil_sak` (svaret
  gjelder en sak som ikke ligger på bordet lenger) gir 409.
- `ufullstendig` gir 422, med hvert felt som `mangler` eller er `ukjent`.
  Feltene heter `vedtak`, `hjemmel`, `kommune` og `felle`.

Et låst svar er alltid et helt svar: vedtak, hjemmel og fella er besvart, og
det som er fylt ut finnes. Fella besvares med et feltnavn, eller `nei` for
«saken er i orden».

**Kapsel**: en cookie. Appene har tre: spillerkapselen (hvem som sitter
der, én per utgave), temakapselen (`forstelinja-tema`) og velkomstkapselen i
Astro. Alle skrives med de samme merkene, lokalt og i drift, på serveren og
i nettleseren: `Path=/; SameSite=None; Secure; Partitioned`. I skallet står
utgavene i rammer fra andre nettsteder, og uten disse merkene sendes ikke
kapselen. En sletting må ha de samme merkene, ellers treffer den ikke.

**Billett** (`?spiller=`): lenka til en annen utgave bærer spillerens id, og
utgaven du kommer til, veksler den inn i sin egen kapsel. Den flytter navnet
ditt mellom domenene, og mellom skallet og en app som er åpnet alene.

**Med på saken** (`medPaSaken`): spilleren var påmeldt da runden begynte.
Skiller `avvik` fra `sent`.

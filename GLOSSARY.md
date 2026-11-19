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

**Med på saken** (`medPaSaken`): spilleren var påmeldt da runden begynte.
Skiller `avvik` fra `sent`.

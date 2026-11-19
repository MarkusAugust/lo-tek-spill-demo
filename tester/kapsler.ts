/**
 * At de tre utgavene skriver kapslene sine med de samme merkene.
 *
 * I skallet står utgavene i rammer fra andre nettsteder. Der sendes en
 * kapsel bare når den er `SameSite=None; Secure`, og i Safari bare når den
 * også er `Partitioned`. En sletting må ha de samme merkene, ellers treffer
 * den ikke, og «gå av vakt» bommer. Regelen er skrevet tre ganger, i Kotlin
 * og to ganger i TypeScript, og det er denne testen som holder dem i takt.
 *
 * Over HTTP: påmeldingen, billettvekslingen og «gå av vakt». I nettleseren:
 * temavelgeren og velkomsten i Astro, som skriver kapselen med
 * `document.cookie`.
 *
 * Merkene er de samme lokalt og i drift. Chromium og WebKit godtar `Secure`
 * på `http://localhost`, så testen ser det samme som en spiller i drift.
 *
 * Kjør med appene oppe (`./kjor.sh rask`): bun run kapsler
 */
import { chromium } from "playwright"

const APPER = [
  { navn: "datastar", url: process.env.DATASTAR_URL ?? "http://localhost:8081" },
  { navn: "tanstack", url: process.env.TANSTACK_URL ?? "http://localhost:8082" },
  { navn: "astro", url: process.env.ASTRO_URL ?? "http://localhost:8083" },
]

const MERKER = ["path=/", "samesite=none", "secure", "partitioned"]

const funn: string[] = []
let sjekket = 0

function merker(kapsel: string): string[] {
  return kapsel
    .split(";")
    .slice(1)
    .map((d) => d.trim().toLowerCase().replace(/\s*=\s*/, "="))
}

function navnPa(kapsel: string): string {
  return kapsel.slice(0, kapsel.indexOf("=")).trim()
}

function slettes(kapsel: string): boolean {
  const m = merker(kapsel)
  return m.includes("max-age=0") || m.some((d) => d.startsWith("expires=") && d.includes("1970"))
}

/** Krever regelens merker på hver kapsel som settes. */
function sjekkSatt(hvor: string, kapsler: string[], navn: RegExp): void {
  const treff = kapsler.filter((k) => navn.test(navnPa(k)) && !slettes(k))
  if (treff.length === 0) funn.push(`${hvor}: satte ingen kapsel som heter ${navn}`)
  for (const k of treff) {
    const mangler = MERKER.filter((m) => !merker(k).includes(m))
    if (mangler.length > 0) funn.push(`${hvor}: ${navnPa(k)} mangler ${mangler.join(", ")}`)
    sjekket += 1
  }
}

const sendTest = { cookie: "forstelinja-test=1" }

for (const app of APPER) {
  // Påmeldingen.
  const pameldt = await fetch(`${app.url}/bli-med`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: app.url, ...sendTest },
    body: "navn=Kapselsjekk",
  })
  const fraPamelding = pameldt.headers.getSetCookie()
  sjekkSatt(`${app.navn} påmelding`, fraPamelding, /^spiller/)
  const spiller = fraPamelding.find((k) => /^spiller/.test(navnPa(k)) && !slettes(k))
  const [kapselNavn, spillerId] = spiller?.split(";")[0].split("=") ?? []

  // Billettvekslingen, med tema.
  if (spillerId) {
    const billett = await fetch(`${app.url}/?spiller=${spillerId}&tema=dark`, {
      redirect: "manual",
      headers: sendTest,
    })
    const fraBillett = billett.headers.getSetCookie()
    sjekkSatt(`${app.navn} billett`, fraBillett, /^spiller/)
    sjekkSatt(`${app.navn} billett`, fraBillett, /^forstelinja-tema$/)
  }

  // «Gå av vakt»: slett med de samme merkene, og den gamle formen uten
  // Partitioned, så en kapsel satt før regelen ikke blir stående.
  const avVakt = await fetch(`${app.url}/ga-av`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: app.url, cookie: `${kapselNavn ?? "spiller"}=${spillerId ?? "x"}; forstelinja-test=1` },
  })
  const slettinger = avVakt.headers.getSetCookie().filter((k) => /^spiller/.test(navnPa(k)) && slettes(k))
  const delt = slettinger.filter((k) => merker(k).includes("partitioned"))
  const gammel = slettinger.filter((k) => !merker(k).includes("partitioned"))
  if (delt.length === 0) funn.push(`${app.navn} gå av vakt: sletter ikke kapselen med Partitioned`)
  for (const k of delt) {
    const mangler = MERKER.filter((m) => !merker(k).includes(m))
    if (mangler.length > 0) funn.push(`${app.navn} gå av vakt: slettingen mangler ${mangler.join(", ")}`)
    sjekket += 1
  }
  if (gammel.length === 0) funn.push(`${app.navn} gå av vakt: sletter ikke den gamle kapselen uten Partitioned`)
}

// Temavelgeren skriver kapselen i nettleseren, med document.cookie.
const nettleser = await chromium.launch()
try {
  for (const app of APPER) {
    const kontekst = await nettleser.newContext()
    await kontekst.addCookies([{ name: "forstelinja-test", value: "1", url: app.url }])
    const side = await kontekst.newPage()
    side.setDefaultTimeout(20_000)
    await side.goto(app.url, { waitUntil: "domcontentloaded" })
    await side.getByRole("button", { name: "Jeg merker nok forskjellen" }).click().catch(() => {})
    await side.getByLabel("Navnet ditt").fill("Temasjekk")
    await side.getByRole("button", { name: "Begynn vakta" }).click()
    await side.locator("#tavle").waitFor()
    // Som i paritetstesten: panelknappen kommer når skriptet har tatt over.
    // Før det slår radioknappen om i nettleseren, og React tegner den
    // tilbake uten at noen kapsel skrives.
    await side.getByRole("button", { name: "Hva skjedde?" }).first().waitFor()
    await side.locator(".temavelger label", { hasText: "Mørkt" }).click()
    await side
      .waitForFunction(() => document.cookie.includes("forstelinja-tema=dark"), undefined, { timeout: 10_000 })
      .catch(() => funn.push(`${app.navn} temavelger: skrev ingen temakapsel`))

    // Velkomstkapselen skriver bare Astro, når hilsenen lukkes.
    const kapsler = await kontekst.cookies(app.url)
    const skrevet = [["temavelger", "forstelinja-tema"], ["velkomst", "forstelinja-velkomst"]] as const
    for (const [hva, navn] of skrevet) {
      const k = kapsler.find((x) => x.name === navn)
      if (!k) {
        if (navn === "forstelinja-velkomst" && app.navn === "astro") funn.push(`astro velkomst: skrev ingen kapsel`)
        continue
      }
      if (k.sameSite !== "None") funn.push(`${app.navn} ${hva}: SameSite er ${k.sameSite}`)
      if (!k.secure) funn.push(`${app.navn} ${hva}: mangler Secure`)
      if (!k.partitionKey) funn.push(`${app.navn} ${hva}: mangler Partitioned`)
      if (k.path !== "/") funn.push(`${app.navn} ${hva}: Path er ${k.path}`)
      sjekket += 1
    }
    await kontekst.close()
  }
} finally {
  await nettleser.close()
}

if (funn.length > 0) {
  console.error(`Fant ${funn.length} avvik:\n${funn.map((f) => `  - ${f}`).join("\n")}`)
  process.exit(1)
}
// Tre apper, med spillerkapselen to ganger, tema, sletting og tema i
// nettleseren, og velkomsten i Astro: under seksten betyr at noe ble hoppet
// over.
if (sjekket < 16) {
  console.error(`Sjekket bare ${sjekket} kapsler. Svarte alle appene?`)
  process.exit(1)
}
console.log(`De tre utgavene skriver alle ${sjekket} kapslene med de samme merkene.`)

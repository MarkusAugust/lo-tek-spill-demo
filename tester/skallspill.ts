/**
 * Én sak med tre spillere i skallet, en i hver ramme.
 *
 * `samtidig.ts` viser at tre spillere ser den samme telleren, og `skall.ts`
 * at skallet viser tre brett. Ingen av dem spiller en sak til ende. Her
 * melder tre seg på, venter på en ny sak så alle er med fra starten, og så:
 *
 * - Kari i Datastar svarer helt riktig, og skal få full pott,
 * - Ola i TanStack har bare vedtaket riktig, og skal få delvis,
 * - Ingrid i Astro svarer ikke, og skal få et avvik.
 *
 * Kvitteringen og resultatdialogen leser resultatet spilltjeneren sender,
 * og testen krever at hver ramme viser sitt, og at alle tre ser de samme
 * tre på tavla.
 *
 * Kjør med appene oppe (`./kjor.sh rask`): bun run skallspill
 */
import { readFileSync } from "node:fs"
import { chromium, type Frame } from "playwright"

const data = JSON.parse(readFileSync("../felles/saker.json", "utf8"))
const kommuner: string[] = JSON.parse(readFileSync("../felles/kommuner.json", "utf8")).kommuner
const APPER = [
  { navn: "datastar", port: "8081", spiller: "Kari", svar: "full" },
  { navn: "tanstack", port: "8082", spiller: "Ola", svar: "delvis" },
  { navn: "astro", port: "8083", spiller: "Ingrid", svar: "ingen svar" },
] as const

const funn: string[] = []
const b = await chromium.launch()
const k = await b.newContext({ viewport: { width: 1800, height: 1000 } })
for (const p of ["8081", "8082", "8083"]) {
  for (const h of ["127.0.0.1", "localhost"]) await k.addCookies([{ name: "forstelinja-test", value: "1", url: `http://${h}:${p}` }])
}
const side = await k.newPage()
side.setDefaultTimeout(20_000)
side.on("console", (m) => { if (m.type() === "error") funn.push(`konsoll: ${m.text().slice(0, 200)}`) })
side.on("pageerror", (e) => funn.push(`sidefeil: ${e.message}`))
await side.goto("http://localhost:8084")
await side.waitForTimeout(3000)

const ramme = (port: string): Frame => {
  const f = side.frames().find((f) => new URL(f.url() || "about:blank").port === port)
  if (!f) throw new Error(`fant ikke rammen på ${port}: ${side.frames().map((f) => f.url()).join(", ")}`)
  return f
}

for (const a of APPER) {
  const f = ramme(a.port)
  await f.getByLabel("Navnet ditt").fill(a.spiller)
  await f.getByRole("button", { name: "Begynn vakta" }).click()
}
for (const a of APPER) await ramme(a.port).locator("#tavle").waitFor()
console.log("alle tre er påmeldt")

// Vent på en ny sak, så alle tre er med på den fra starten.
const sakId = async (f: Frame) => (await f.locator(".sakskort .lt-tag").first().textContent({ timeout: 2000 }).catch(() => null))?.replace("Sak ", "").trim() ?? null
const forste = await sakId(ramme("8081"))
let sak: string | null = null
for (let i = 0; i < 90 && !sak; i++) {
  await side.waitForTimeout(1000)
  const id = await sakId(ramme("8081"))
  if (id && id !== forste && (await ramme("8081").getByRole("button", { name: "Fatt vedtak" }).count()) > 0) sak = id
}
if (!sak) throw new Error("ingen ny sak begynte")
console.log("ny sak:", sak)
const fasit = data.saker.find((s: any) => s.id === sak)
const riktigKommune = kommuner.includes(fasit.soker.kommune) ? fasit.soker.kommune : ""
const annenHjemmel = data.hjemler.map((h: any) => h.kode).find((k: string) => k !== fasit.fasit.hjemmel)
const annenKommune = kommuner.find((k) => k !== riktigKommune)!

async function fyll(f: Frame, vedtak: string, hjemmel: string, kommune: string, felle: string) {
  await f.locator(`#v-${vedtak}`).check()
  await f.selectOption("#hjemmel", hjemmel)
  await f.locator("#kommune").fill(kommune)
  await f.locator("#kommune").press("Escape").catch(() => {})
  await f.selectOption("#felle", felle)
  await f.getByRole("button", { name: "Fatt vedtak" }).click()
}
const feilVedtak = fasit.fasit.vedtak === "innvilget" ? "avslatt" : "innvilget"
await fyll(ramme("8081"), fasit.fasit.vedtak, fasit.fasit.hjemmel, riktigKommune, fasit.fasit.felle ?? "nei")
await fyll(ramme("8082"), fasit.fasit.vedtak, annenHjemmel, annenKommune, fasit.fasit.felle ? "nei" : "epost")

for (const [port, venter] of [["8081", "Full pott"], ["8082", "Delvis truffet"]] as const) {
  const f = ramme(port)
  await f.getByText("Vedtaket er fattet").waitFor().catch(() => funn.push(`${port}: ingen kvittering`))
  const tekst = await f.locator(".vedtakskort").first().innerText().catch(() => "")
  if (!tekst.includes(venter)) funn.push(`${port}: kvitteringen sier ikke «${venter}»: ${tekst.slice(0, 120).replace(/\s+/g, " ")}`)
  else console.log(port, "kvittering:", venter)
}

const forventet: Record<string, string> = { "8081": "full", "8082": "delvis", "8083": "avvik" }
for (const a of APPER) {
  const f = ramme(a.port)
  const d = f.locator("dialog.resultat[open]")
  await d.waitFor({ timeout: 60_000 }).catch(() => funn.push(`${a.navn}: ingen resultatdialog`))
  const r = await d.getAttribute("data-resultat").catch(() => null)
  const h = (await d.locator("h2").first().innerText().catch(() => "")).trim()
  console.log(a.navn, a.spiller, "resultat:", r, "|", h)
  if (r !== forventet[a.port]) funn.push(`${a.navn}: resultatet var ${r}, ventet ${forventet[a.port]}`)
  const tavle = await f.locator("#tavle").innerText()
  for (const n of ["Kari", "Ola", "Ingrid"]) if (!tavle.includes(n)) funn.push(`${a.navn}: tavla mangler ${n}`)
}
await b.close()

if (funn.length > 0) {
  console.error(`Fant ${funn.length} avvik:\n${funn.map((f) => `  - ${f}`).join("\n")}`)
  process.exit(1)
}
console.log("Tre spillere i skallet fikk full pott, delvis og avvik, og ser den samme tavla.")

/**
 * Den som kommer til et sovende spill.
 *
 * Railway legger tjenestene i dvale når ingen spiller, og den første
 * forespørselen vekker dem. Målt i drift tar det rundt tre sekunder, og
 * spilltjeneren er den siste som våkner. Testen gjør det samme lokalt ved å
 * slå av spilltjeneren og starte den igjen, og krever tre ting av hver app:
 *
 * 1. Når spilltjeneren er borte, svarer forsiden med ventesiden, den samme i
 *    alle tre, etter å ha ventet rundt fem sekunder. `/klar` sier nei.
 * 2. En side som står på ventesiden, går videre til spillet av seg selv når
 *    spilltjeneren kommer, uten at noen laster den på nytt.
 * 3. Våkner spilltjeneren innen fem sekunder, får den som venter spillet
 *    direkte og ser aldri ventesiden.
 *
 * Testen slår av spilltjeneren som `./kjor.sh` startet, og starter sin egen.
 * Den står igjen når testen er ferdig, så resten av stabelen virker, men den
 * stoppes ikke av Ctrl+C i `./kjor.sh`. Porten sier fra neste gang.
 *
 * Kjør med appene oppe (`./kjor.sh rask`): bun run venteside
 */
import { spawn, spawnSync } from "node:child_process"
import { join } from "node:path"
import { chromium } from "playwright"

const APPER = [
  { navn: "datastar", url: process.env.DATASTAR_URL ?? "http://localhost:8081" },
  { navn: "tanstack", url: process.env.TANSTACK_URL ?? "http://localhost:8082" },
  { navn: "astro", url: process.env.ASTRO_URL ?? "http://localhost:8083" },
]
const SPILLTJENER = "http://127.0.0.1:8080"

const funn: string[] = []

async function oppe(): Promise<boolean> {
  return fetch(`${SPILLTJENER}/helse`, { signal: AbortSignal.timeout(500) })
    .then((s) => s.ok)
    .catch(() => false)
}

async function slaAv(): Promise<void> {
  const pider = spawnSync("lsof", ["-nP", "-iTCP:8080", "-sTCP:LISTEN", "-t"]).stdout.toString().trim()
  for (const pid of pider.split("\n").filter(Boolean)) process.kill(Number(pid))
  for (let i = 0; i < 50 && (await oppe()); i++) await Bun.sleep(200)
  if (await oppe()) throw new Error("spilltjeneren ville ikke stoppe")
}

function start(): void {
  const prosess = spawn(join(import.meta.dir, "../apper/spilltjener/build/install/spilltjener/bin/spilltjener"), [], {
    cwd: join(import.meta.dir, "../apper/spilltjener"),
    env: {
      ...process.env,
      PORT: "8080",
      HOST: "127.0.0.1",
      RUNDE_MS: process.env.RUNDE_MS ?? "30000",
      OPPGJOR_MS: process.env.OPPGJOR_MS ?? "8000",
      SLUTT_MS: process.env.SLUTT_MS ?? "15000",
    },
    detached: true,
    stdio: "ignore",
  })
  prosess.unref()
}

async function ventTilOppe(sekunder: number): Promise<void> {
  for (let i = 0; i < sekunder * 5 && !(await oppe()); i++) await Bun.sleep(200)
  if (!(await oppe())) throw new Error(`spilltjeneren kom ikke opp på ${sekunder} sekunder`)
}

/** Ventesiden uten det ene som skiller appene: adressen til LO-TEK. */
function uten_stilark(html: string): string {
  return html.replace(/<link rel="stylesheet" href="[^"]*lotek\.css">/, "")
}

// 1. Spilltjeneren er borte.
await slaAv()
const sider: string[] = []
for (const app of APPER) {
  const t0 = Date.now()
  const svar = await fetch(app.url, { headers: { cookie: "forstelinja-test=1" } })
  const tid = (Date.now() - t0) / 1000
  const html = await svar.text()
  if (svar.status !== 503) funn.push(`${app.navn}: forsiden svarte ${svar.status}, ikke 503`)
  if (!html.includes("Kontoret åpner")) funn.push(`${app.navn}: forsiden er ikke ventesiden`)
  if (tid < 4.5) funn.push(`${app.navn}: ga opp etter ${tid} sekunder, ikke fem`)
  sider.push(uten_stilark(html))
  const klar = await fetch(`${app.url}/klar`)
  if (klar.status !== 503) funn.push(`${app.navn}: /klar svarte ${klar.status} med spilltjeneren borte`)
  const stilark = html.match(/href="([^"]*lotek\.css)"/)?.[1]
  if (!stilark) funn.push(`${app.navn}: ventesiden lenker ikke til LO-TEK`)
  else {
    const css = await fetch(new URL(stilark, app.url))
    if (!css.ok || !(await css.text()).includes(".lt-spinner")) funn.push(`${app.navn}: ${stilark} gir ikke LO-TEK`)
  }
}
if (new Set(sider).size !== 1) funn.push("ventesiden er ikke den samme i de tre appene")

// 2. Sidene står på ventesiden, og spilltjeneren kommer tilbake.
const nettleser = await chromium.launch()
try {
  const ventende = await Promise.all(
    APPER.map(async (app) => {
      const kontekst = await nettleser.newContext()
      await kontekst.addCookies([{ name: "forstelinja-test", value: "1", url: app.url }])
      const side = await kontekst.newPage()
      await side.goto(app.url, { waitUntil: "domcontentloaded" })
      await side.getByRole("heading", { name: "Kontoret åpner" }).waitFor({ timeout: 15_000 })
      return { app, side }
    }),
  )
  start()
  await ventTilOppe(30)
  for (const { app, side } of ventende) {
    const videre = await side
      .waitForFunction(() => !document.body.textContent?.includes("Kontoret åpner"), undefined, {
        timeout: 10_000,
      })
      .then(() => true)
      .catch(() => false)
    if (!videre) funn.push(`${app.navn}: ventesiden gikk ikke videre til spillet av seg selv`)
  }
} finally {
  await nettleser.close()
}

// 3. Spilltjeneren våkner mens appen venter.
await slaAv()
const forsok = APPER.map(async (app) => {
  const svar = await fetch(app.url, { headers: { cookie: "forstelinja-test=1" } })
  const html = await svar.text()
  if (svar.status !== 200 || html.includes("Kontoret åpner")) {
    funn.push(`${app.navn}: spilltjeneren kom innen fem sekunder, men svaret var ${svar.status} og ${html.includes("Kontoret åpner") ? "ventesiden" : "ikke spillet"}`)
  }
})
await Bun.sleep(500)
start()
await Promise.all(forsok)
await ventTilOppe(30)

if (funn.length > 0) {
  console.error(`Fant ${funn.length} avvik:\n${funn.map((f) => `  - ${f}`).join("\n")}`)
  process.exit(1)
}
console.log("Ventesiden er den samme i alle tre, går videre av seg selv, og vises ikke når spilltjeneren våkner i tide.")

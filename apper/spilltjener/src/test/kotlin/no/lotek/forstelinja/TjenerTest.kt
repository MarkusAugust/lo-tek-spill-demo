package no.lotek.forstelinja

import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Det appene ser av `/api/svar`: statusen og grunnen.
 *
 * Reglene testes i [SpillTest]. Her sjekkes bare at en avvisning når fram
 * slik appene leser den, for det var den alle tre overså før.
 */
class TjenerTest {
  private lateinit var fil: java.io.File
  private val klokke = FalskKlokke(1_000_000)

  private val samling =
    Sakssamling(
      hjemler = listOf(Hjemmel("§ 4-1", "Alminnelig", "Hovedregelen.")),
      saker =
        (1..RUNDER_PER_SPILL).map { nr ->
          Sak(
            id = "sak-$nr",
            tittel = "Sak $nr",
            sammendrag = "…",
            tekst = "…",
            soker = Soker("Navn", "01.01.1980", "Oslo", "navn@example.no"),
            fasit = Fasit(Vedtak.INNVILGET, "§ 4-1", null),
            forklaring = "Fordi.",
          )
        },
    )

  @BeforeTest
  fun foer() {
    fil = java.io.File.createTempFile("toppliste", ".db")
  }

  @AfterTest
  fun etter() {
    fil.delete()
  }

  private fun medTjener(blokk: suspend (spill: Spill, svar: suspend (String) -> Pair<HttpStatusCode, String>) -> Unit) =
    testApplication {
      val spill = Spill(samling, Toppliste(fil.absolutePath, klokke), klokke, kommuner = listOf("Oslo"))
      application { spillModul(spill, Varme(klokke = klokke)) }
      blokk(spill) { kropp ->
        val svar =
          client.post("/api/svar") {
            contentType(ContentType.Application.Json)
            setBody(kropp)
          }
        svar.status to svar.bodyAsText()
      }
    }

  @Test
  fun `et ufullstendig svar gir 422 og feltene`() = medTjener { spill, svar ->
    val kari = spill.bliMed("Kari", Stack.ASTRO)

    val (status, kropp) = svar("""{"spillerId":"${kari.id}","svar":{"sakId":"${spill.sak.id}","felle":"nei"}}""")

    assertEquals(HttpStatusCode.UnprocessableEntity, status)
    assertTrue(kropp.contains(""""grunn":"ufullstendig""""), kropp)
    assertTrue(kropp.contains("""{"felt":"hjemmel","feil":"mangler"}"""), kropp)
  }

  @Test
  fun `et svar på feil sak gir 409`() = medTjener { spill, svar ->
    val kari = spill.bliMed("Kari", Stack.ASTRO)

    val (status, kropp) =
      svar("""{"spillerId":"${kari.id}","svar":{"sakId":"gammel","vedtak":"innvilget","hjemmel":"§ 4-1","felle":"nei"}}""")

    assertEquals(HttpStatusCode.Conflict, status)
    assertTrue(kropp.contains(""""grunn":"feil_sak""""), kropp)
  }

  @Test
  fun `et helt svar gir 200`() = medTjener { spill, svar ->
    val kari = spill.bliMed("Kari", Stack.ASTRO)

    val (status, kropp) =
      svar("""{"spillerId":"${kari.id}","svar":{"sakId":"${spill.sak.id}","vedtak":"innvilget","hjemmel":"§ 4-1","felle":"nei"}}""")

    assertEquals(HttpStatusCode.OK, status, kropp)
    assertTrue(kropp.contains(""""ok":true"""), kropp)
  }
}

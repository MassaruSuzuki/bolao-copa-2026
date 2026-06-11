import { db, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchAllWcMatches, mapFdMatch } from "../services/footballData";
import { logger } from "./logger";

export async function syncMatchesOnStartup(): Promise<void> {
  const apiKey = process.env["FOOTBALL_DATA_API_KEY"];

  if (!apiKey) {
    logger.warn(
      "FOOTBALL_DATA_API_KEY não configurada — sincronização de jogos ignorada"
    );
    return;
  }

  try {
    logger.info("Sincronizando jogos da Copa do Mundo 2026...");

    const fdMatches = await fetchAllWcMatches();

    let created = 0;
    let updated = 0;

    for (const fdMatch of fdMatches) {
      if (!fdMatch.homeTeam?.name || !fdMatch.awayTeam?.name) continue;

      const mapped = mapFdMatch(fdMatch);

      const [existing] = await db
        .select({
          id: matchesTable.id,
          status: matchesTable.status,
        })
        .from(matchesTable)
        .where(eq(matchesTable.externalId, fdMatch.id));

      if (!existing) {
        await db.insert(matchesTable).values(mapped);
        created++;
        continue;
      }

      const nextStatus =
        existing.status === "live" && mapped.status !== "finished"
          ? "live"
          : mapped.status;

      await db
        .update(matchesTable)
        .set({
          homeTeam: mapped.homeTeam,
          awayTeam: mapped.awayTeam,
          homeLogo: mapped.homeLogo,
          awayLogo: mapped.awayLogo,
          matchDate: mapped.matchDate,
          status: nextStatus,
          homeScore: mapped.homeScore,
          awayScore: mapped.awayScore,
        })
        .where(eq(matchesTable.externalId, fdMatch.id));

      updated++;
    }

    logger.info(
      { created, updated, total: fdMatches.length },
      "Jogos sincronizados com sucesso"
    );
  } catch (err) {
    logger.error({ err }, "Falha ao sincronizar jogos na inicialização");
  }
}
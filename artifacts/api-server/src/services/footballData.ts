import { logger } from "../lib/logger";

const BASE_URL = "https://api.football-data.org/v4";
const API_KEY = process.env["FOOTBALL_DATA_API_KEY"] ?? "";
const COMPETITION = "WC";
const SEASON = "2026";

type FdStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export interface FdMatch {
  id: number;
  utcDate: string;
  status: FdStatus;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  score: {
    winner: string | null;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };
}

function toInternalStatus(fdStatus: FdStatus): "upcoming" | "live" | "finished" {
  if (fdStatus === "IN_PLAY" || fdStatus === "PAUSED") return "live";
  if (fdStatus === "FINISHED" || fdStatus === "AWARDED") return "finished";
  return "upcoming";
}

function getCurrentScore(m: FdMatch) {
  return {
    home:
      m.score.fullTime.home ??
      m.score.halfTime.home ??
      null,
    away:
      m.score.fullTime.away ??
      m.score.halfTime.away ??
      null,
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-Auth-Token": API_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text();

    throw new Error(`football-data.org ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchAllWcMatches(): Promise<FdMatch[]> {
  const data = await fetchJson<{ matches: FdMatch[] }>(
    `/competitions/${COMPETITION}/matches?season=${SEASON}`
  );

  return data.matches;
}

export async function fetchLiveWcMatches(): Promise<FdMatch[]> {
  const data = await fetchJson<{ matches: FdMatch[] }>(
    `/competitions/${COMPETITION}/matches?status=IN_PLAY,PAUSED`
  );

  return data.matches;
}

export function mapFdMatch(m: FdMatch) {
  const currentScore = getCurrentScore(m);

  return {
    externalId: m.id,
    homeTeam: m.homeTeam.shortName || m.homeTeam.name,
    awayTeam: m.awayTeam.shortName || m.awayTeam.name,
    homeLogo: m.homeTeam.crest || null,
    awayLogo: m.awayTeam.crest || null,
    matchDate: new Date(m.utcDate),
    status: toInternalStatus(m.status),
    homeScore: currentScore.home,
    awayScore: currentScore.away,
  };
}

export { toInternalStatus };
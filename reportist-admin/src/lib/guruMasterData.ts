import guruDataJson from "./guruMasterData.json";
import { GURU_PERSONAS, GuruPersona } from "./guruPersonas";

export interface GuruMasterDetail extends GuruPersona {
  agentMarkdown: string;
  bookMarkdown: string;
}

export function getGuruDetail(slug: string): GuruMasterDetail | null {
  const base = GURU_PERSONAS[slug];
  if (!base) return null;

  const raw = (guruDataJson as Record<string, { agentMarkdown: string; bookMarkdown: string }>)[slug];

  return {
    ...base,
    agentMarkdown: raw?.agentMarkdown || "",
    bookMarkdown: raw?.bookMarkdown || "",
  };
}

export function getAllGuruDetails(): GuruMasterDetail[] {
  return Object.keys(GURU_PERSONAS).map((slug) => getGuruDetail(slug)!);
}

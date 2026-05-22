import type { JobAbbreviation } from "@/types/ffixiv-job";

export const JOB_GROUPS: { label: string; jobs: JobAbbreviation[] }[] = [
  { label: "Tank",   jobs: ["PLD", "WAR", "DRK", "GNB"] },
  { label: "Healer", jobs: ["WHM", "SCH", "AST", "SGE"] },
  { label: "Melee",  jobs: ["DRG", "MNK", "NIN", "SAM", "RPR", "VPR"] },
  { label: "Ranged", jobs: ["BRD", "MCH", "DNC"] },
  { label: "Caster", jobs: ["BLM", "SMN", "RDM", "PCT"] },
];

export const JOB_NAMES: Record<JobAbbreviation, string> = {
  PLD: "Paladin",    WAR: "Warrior",    DRK: "Dark Knight", GNB: "Gunbreaker",
  WHM: "White Mage", SCH: "Scholar",    AST: "Astrologian", SGE: "Sage",
  DRG: "Dragoon",    MNK: "Monk",       NIN: "Ninja",       SAM: "Samurai",
  RPR: "Reaper",     VPR: "Viper",
  BRD: "Bard",       MCH: "Machinist",  DNC: "Dancer",
  BLM: "Black Mage", SMN: "Summoner",   RDM: "Red Mage",    PCT: "Pictomancer",
};

export const ALL_JOBS: JobAbbreviation[] = JOB_GROUPS.flatMap((g) => g.jobs);

/** FFLogs uses camelCase job identifiers (e.g. "DarkKnight") rather than abbreviations. */
export const FFLOGS_JOB_MAP: Record<string, JobAbbreviation> = {
  Paladin: "PLD", Warrior: "WAR", DarkKnight: "DRK", Gunbreaker: "GNB",
  WhiteMage: "WHM", Scholar: "SCH", Astrologian: "AST", Sage: "SGE",
  Dragoon: "DRG", Monk: "MNK", Ninja: "NIN", Samurai: "SAM", Reaper: "RPR", Viper: "VPR",
  Bard: "BRD", Machinist: "MCH", Dancer: "DNC",
  BlackMage: "BLM", Summoner: "SMN", RedMage: "RDM", Pictomancer: "PCT",
};

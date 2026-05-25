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

export const JOB_ROLE_COLOR: Partial<Record<JobAbbreviation, string>> = {
  PLD:'#60a5fa', WAR:'#60a5fa', DRK:'#60a5fa', GNB:'#60a5fa',
  WHM:'#4ade80', SCH:'#4ade80', AST:'#4ade80', SGE:'#4ade80',
  DRG:'#f472b6', MNK:'#f472b6', NIN:'#f472b6', SAM:'#f472b6', RPR:'#f472b6', VPR:'#f472b6',
  BRD:'#fbbf24', MCH:'#fbbf24', DNC:'#fbbf24',
  BLM:'#c084fc', SMN:'#c084fc', RDM:'#c084fc', PCT:'#c084fc',
};

/** FFLogs uses camelCase job identifiers (e.g. "DarkKnight") rather than abbreviations. */
export const FFLOGS_JOB_MAP: Record<string, JobAbbreviation> = {
  Paladin: "PLD", Warrior: "WAR", DarkKnight: "DRK", Gunbreaker: "GNB",
  WhiteMage: "WHM", Scholar: "SCH", Astrologian: "AST", Sage: "SGE",
  Dragoon: "DRG", Monk: "MNK", Ninja: "NIN", Samurai: "SAM", Reaper: "RPR", Viper: "VPR",
  Bard: "BRD", Machinist: "MCH", Dancer: "DNC",
  BlackMage: "BLM", Summoner: "SMN", RedMage: "RDM", Pictomancer: "PCT",
};

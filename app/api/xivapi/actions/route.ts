import type { XivApiAction } from "@/types/job-ability";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import { ALL_JOBS } from "@/lib/jobs";

const VALID_JOBS = new Set<JobAbbreviation>(ALL_JOBS);

// Jobs that inherit low-level actions from a base class
const BASE_CLASS: Partial<Record<JobAbbreviation, string>> = {
  PLD: "GLA", WAR: "MRD",
  DRG: "LNC", MNK: "PGL", NIN: "ROG", BRD: "ARC",
  WHM: "CNJ", BLM: "THM", SMN: "ACN", SCH: "ACN",
};

const XIVAPI_BASE = "https://v2.xivapi.com/api";

interface V2Icon {
  path?: string;
  path_hr1?: string;
}

interface V2ClassJobCategory {
  fields?: Record<string, boolean>;
}

interface V2SearchResult {
  row_id: number;
  fields: {
    Name?: string;
    Icon?: V2Icon;
    Recast100ms?: number;
    IsRoleAction?: boolean;
    ClassJobCategory?: V2ClassJobCategory;
  };
}

interface V2SearchResponse {
  results?: V2SearchResult[];
  next?: string | null;
}

function iconUrl(icon: V2Icon | null | undefined): string {
  const path = icon?.path_hr1 ?? icon?.path;
  if (!path) return "";
  return `${XIVAPI_BASE}/asset?path=${encodeURIComponent(path)}&format=png`;
}

function buildQuery(job: JobAbbreviation): string {
  const base = BASE_CLASS[job];
  // The group matches job-specific actions (including base class if any) OR role actions.
  // All must be player actions at a positive level and belong to the job's category.
  const classMatches = base
    ? `ClassJob.Abbreviation="${job}" ClassJob.Abbreviation="${base}" IsRoleAction=true`
    : `ClassJob.Abbreviation="${job}" IsRoleAction=true`;

  return `+(${classMatches}) +IsPlayerAction=true +ClassJobCategory.${job}=true +ClassJobLevel>0`;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const job = searchParams.get("job");

  if (!job || !VALID_JOBS.has(job as JobAbbreviation)) {
    return Response.json({ error: "Valid job abbreviation required" }, { status: 400 });
  }

  const allResults: V2SearchResult[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${XIVAPI_BASE}/search`);
    url.searchParams.set("sheets", "Action");
    url.searchParams.set("query", buildQuery(job as JobAbbreviation));
    url.searchParams.set("fields", "Name,Icon,Recast100ms,IsRoleAction,ClassJobCategory");
    url.searchParams.set("limit", "250");
    url.searchParams.set("language", "en");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[xivapi/actions] XIVAPI returned ${res.status}:`, text.slice(0, 500));
      return Response.json({ error: "XIVAPI request failed" }, { status: 502 });
    }

    const data = (await res.json()) as V2SearchResponse;
    allResults.push(...(data.results ?? []));
    cursor = data.next ?? null;
  } while (cursor && allResults.length < 500);

  const actions: XivApiAction[] = allResults
    .map((result) => {
      const f = result.fields;
      return {
        xivapiId: result.row_id,
        name: f.Name ?? "",
        iconPath: iconUrl(f.Icon),
        cooldown: Math.round((f.Recast100ms ?? 0) / 10),
        duration: 0,
        isRoleAction: f.IsRoleAction === true,
        classJobCategory: f.ClassJobCategory?.fields ?? {},
      };
    })
    .filter((a) => a.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({ actions });
}

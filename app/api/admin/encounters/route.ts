import { adminDb } from "@/lib/firebase-admin";
import type { TimelineRow } from "@/types/timeline";
import type { PhaseDivider } from "@/types/player";

interface EncounterPayload {
  id?: string;
  name: string;
  type?: string;
  tier: string;
  patch: string;
  timeline: TimelineRow[];
  phases: PhaseDivider[];
}

export async function GET(): Promise<Response> {
  try {
    const snap = await adminDb.collection("encounters").orderBy("createdAt", "desc").get();
    const encounters = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json({ encounters });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as EncounterPayload;
    const { id, name, type, tier, patch, timeline, phases } = body;

    if (!name?.trim()) return Response.json({ error: "name is required" }, { status: 400 });

    const now = Date.now();
    const docId = id || crypto.randomUUID();
    const ref = adminDb.collection("encounters").doc(docId);
    const existing = await ref.get();

    await ref.set({
      id: docId,
      name: name.trim(),
      type: type ?? "",
      tier: tier?.trim() ?? "",
      patch: patch?.trim() ?? "",
      timeline: timeline ?? [],
      phases: phases ?? [],
      createdAt: existing.exists ? existing.data()!.createdAt : now,
      updatedAt: now,
    });

    return Response.json({ id: docId });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

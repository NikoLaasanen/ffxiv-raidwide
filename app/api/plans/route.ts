import { adminDb } from "@/lib/firebase-admin";
import type { Plan } from "@/types/plan";
import { apiError } from "@/lib/api-error";
import { COLLECTIONS } from "@/lib/db-collections";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validatePlan(plan: unknown): plan is Plan {
  if (!plan || typeof plan !== "object") return false;
  const p = plan as Record<string, unknown>;
  return (
    typeof p.editLinkId === "string" && UUID_RE.test(p.editLinkId) &&
    typeof p.viewLinkId === "string" && UUID_RE.test(p.viewLinkId) &&
    typeof p.title === "string" && p.title.length <= 200 &&
    Array.isArray(p.timeline) && p.timeline.length <= 1000 &&
    Array.isArray(p.players) && p.players.length <= 8 &&
    Array.isArray(p.phases)
  );
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!validatePlan(body)) {
      return Response.json({ error: "Invalid plan data" }, { status: 400 });
    }
    const plan = body;
    const ref = adminDb.collection(COLLECTIONS.PLANS).doc(plan.editLinkId);
    await ref.set(plan);
    return Response.json({ editLinkId: plan.editLinkId, viewLinkId: plan.viewLinkId });
  } catch (e) {
    return apiError(e);
  }
}

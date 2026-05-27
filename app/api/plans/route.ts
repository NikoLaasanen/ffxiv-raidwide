import { adminDb } from "@/lib/firebase-admin";
import type { Plan } from "@/types/plan";
import { apiError } from "@/lib/api-error";
import { COLLECTIONS } from "@/lib/db-collections";

export async function POST(request: Request) {
  try {
    const plan: Plan = await request.json();
    const ref = adminDb.collection(COLLECTIONS.PLANS).doc(plan.editLinkId);
    await ref.set(plan);
    return Response.json({ editLinkId: plan.editLinkId, viewLinkId: plan.viewLinkId });
  } catch (e) {
    return apiError(e);
  }
}

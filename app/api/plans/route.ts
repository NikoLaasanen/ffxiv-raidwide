import { adminDb } from "@/lib/firebase-admin";
import type { Plan } from "@/types/plan";

export async function POST(request: Request) {
  try {
    const plan: Plan = await request.json();
    const ref = adminDb.collection("plans").doc(plan.editLinkId);
    await ref.set(plan);
    return Response.json({ editLinkId: plan.editLinkId, viewLinkId: plan.viewLinkId });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Plan } from "@/types/plan";
import { upsertMyPlan } from "@/lib/my-plans-storage";

export async function savePlan(plan: Plan): Promise<void> {
  const res = await fetch("/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (res.ok) {
    upsertMyPlan({
      id: plan.id,
      title: plan.title,
      editLinkId: plan.editLinkId,
      viewLinkId: plan.viewLinkId,
      encounterId: plan.encounterId,
      updatedAt: plan.updatedAt,
      savedAt: Date.now(),
    });
  }
  if (!res.ok) {
    const text = await res.text();
    let message = "Failed to save plan";
    try {
      const body = JSON.parse(text);
      message = body.error ?? message;
    } catch {
      message = `Failed to save plan (${res.status}): ${text.slice(0, 200)}`;
    }
    throw new Error(message);
  }
}

export async function updatePlan(plan: Plan): Promise<void> {
  const res = await fetch("/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = "Failed to update plan";
    try {
      message = JSON.parse(text).error ?? message;
    } catch {
      /* */
    }
    throw new Error(message);
  }
}

export async function getPlan(id: string): Promise<Plan | null> {
  const ref = doc(db, "plans", id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Plan) : null;
}

export async function getPlanByViewLink(viewLinkId: string): Promise<Plan | null> {
  const q = query(collection(db, "plans"), where("viewLinkId", "==", viewLinkId));
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as Plan);
}

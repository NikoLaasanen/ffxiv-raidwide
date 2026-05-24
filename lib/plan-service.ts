import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Plan } from "@/types/plan";

export async function savePlan(plan: Plan): Promise<void> {
  const res = await fetch("/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
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

export async function getPlan(id: string): Promise<Plan | null> {
  const ref = doc(db, "plans", id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Plan) : null;
}

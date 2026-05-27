import { adminDb } from "@/lib/firebase-admin";
import type { JobAbilityRecord } from "@/types/job-ability";
import { apiError } from "@/lib/api-error";
import { COLLECTIONS } from "@/lib/db-collections";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const job = searchParams.get("job");
    if (!job) return Response.json({ error: "Missing job param" }, { status: 400 });

    const snapshot = await adminDb
      .collection(COLLECTIONS.JOB_ABILITIES)
      .where("jobs", "array-contains", job)
      .get();

    const abilities = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        xivapiId: d.xivapiId as number,
        duration: d.duration as number,
        mitigationPhysical: d.mitigationPhysical as number,
        mitigationMagical: d.mitigationMagical as number,
        target: d.target as string,
        abilityType: d.abilityType as string,
      };
    });
    return Response.json({ abilities });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const abilities: Omit<JobAbilityRecord, "createdAt" | "updatedAt">[] = await request.json();

    const batch = adminDb.batch();
    const now = Date.now();

    for (const ability of abilities) {
      const ref = adminDb.collection(COLLECTIONS.JOB_ABILITIES).doc(ability.id);
      batch.set(ref, { ...ability, createdAt: now, updatedAt: now });
    }

    await batch.commit();
    return Response.json({ saved: abilities.length });
  } catch (e) {
    return apiError(e);
  }
}

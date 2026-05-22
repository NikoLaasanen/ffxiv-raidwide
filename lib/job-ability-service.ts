import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";

export async function getJobAbilities(job: JobAbbreviation): Promise<JobAbilityRecord[]> {
  const q = query(collection(db, "job_abilities"), where("jobs", "array-contains", job));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobAbilityRecord));
}

export async function saveJobAbilities(
  abilities: Omit<JobAbilityRecord, "createdAt" | "updatedAt">[]
): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();
  for (const ability of abilities) {
    const ref = doc(db, "job_abilities", ability.id);
    batch.set(ref, { ...ability, createdAt: now, updatedAt: now });
  }
  await batch.commit();
}

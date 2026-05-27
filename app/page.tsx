import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db-collections";
import type { EncounterDoc } from "@/types/encounter";
import HomeClient from "./_home-client";

export const revalidate = 3600; // re-fetch encounters from Firestore at most once per hour

export default async function HomePage() {
  let initialEncounters: EncounterDoc[] | undefined;
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.ENCOUNTERS)
      .orderBy("createdAt", "desc")
      .get();
    initialEncounters = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as EncounterDoc[];
  } catch {
    // client will fall back to fetching via API
  }
  return <HomeClient initialEncounters={initialEncounters} />;
}

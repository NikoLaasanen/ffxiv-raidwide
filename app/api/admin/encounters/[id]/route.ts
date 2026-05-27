import { adminDb } from "@/lib/firebase-admin";
import { apiError } from "@/lib/api-error";
import { COLLECTIONS } from "@/lib/db-collections";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    await adminDb.collection(COLLECTIONS.ENCOUNTERS).doc(id).delete();
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

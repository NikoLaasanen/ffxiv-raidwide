export function apiError(e: unknown, status = 500): Response {
  return Response.json(
    { error: e instanceof Error ? e.message : String(e) },
    { status }
  );
}

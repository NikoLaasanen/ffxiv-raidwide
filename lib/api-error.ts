export function apiError(e: unknown, status = 500): Response {
  console.error("[api-error]", e);
  return Response.json({ error: "An unexpected error occurred" }, { status });
}

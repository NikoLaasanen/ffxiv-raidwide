import "server-only";
import type { FFLogsTokenResponse } from "@/types/fflogs";

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 5000) {
    return tokenCache.token;
  }

  const clientId = process.env.FFLOGS_CLIENT_ID;
  const clientSecret = process.env.FFLOGS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("FFLOGS_CLIENT_ID and FFLOGS_CLIENT_SECRET must be set");
  }

  const response = await fetch("https://www.fflogs.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
  });

  if (!response.ok) {
    throw new Error(`FFLogs token request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as FFLogsTokenResponse;
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

export async function fflogsGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await getToken();

  const response = await fetch("https://www.fflogs.com/api/v2/client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`FFLogs GraphQL request failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as { data: T; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(`FFLogs GraphQL error: ${json.errors[0].message}`);
  }

  return json.data;
}

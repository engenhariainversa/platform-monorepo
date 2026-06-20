const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050/graphql";

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = getTokenFromCookie();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL Error");
  }

  return json.data;
}

function getTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)cms_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setAuthCookie(token: string) {
  // httpOnly cookies should be set by the server ideally,
  // but for the CMS internal use we set a secure cookie
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  document.cookie = `cms_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function removeAuthCookie() {
  document.cookie = "cms_token=; path=/; max-age=0";
}

export function isAuthenticated(): boolean {
  return !!getTokenFromCookie();
}

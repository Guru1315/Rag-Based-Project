import type { ApiResponse } from "@/types";

/** Error with a code and a message that is safe to show to the user. */
export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Small fetch wrapper for our own /api routes. Returns `data` or throws ApiClientError. */
export async function api<T>(
  url: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const hasBody = options.body !== undefined;
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (hasBody ? "POST" : "GET"),
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiClientError("NETWORK", "Network error. Check your connection and try again.");
  }

  let json: ApiResponse<T>;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    if (response.status === 504 || response.status === 408) {
      throw new ApiClientError("TIMEOUT", "The server took too long to respond. Please try again.");
    }
    throw new ApiClientError("BAD_RESPONSE", `Unexpected server response (${response.status}).`);
  }
  if (!json.ok) throw new ApiClientError(json.error.code, json.error.message);
  return json.data;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

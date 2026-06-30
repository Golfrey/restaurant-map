function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function errorMessageFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string" && message.trim()) return message;
  const error = record.error;
  if (error && typeof error === "object") {
    const nested = (error as Record<string, unknown>).message;
    if (typeof nested === "string" && nested.trim()) return nested;
  }
  return undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  options: { sourceName: string; timeoutMs: number }
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });
    const text = await response.text();

    if (!response.ok) {
      const payload = text.trim() ? parseJsonObject(text) : null;
      const message = errorMessageFromPayload(payload);
      throw new Error(
        message
          ? `${options.sourceName} request failed with ${response.status}: ${message}`
          : `${options.sourceName} request failed with ${response.status}`
      );
    }

    if (!text.trim()) {
      throw new Error(`${options.sourceName} returned an empty response.`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`${options.sourceName} returned invalid JSON.`);
    }
    if (!payload || typeof payload !== "object") {
      throw new Error(`${options.sourceName} returned an invalid response.`);
    }
    return payload as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`${options.sourceName} request timed out after ${options.timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function requireArray<T>(value: unknown, sourceName: string, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${sourceName} response field ${fieldName} must be an array.`);
  }
  return value as T[];
}

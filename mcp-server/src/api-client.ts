export class RemoAssetApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoAssetApiError';
  }
}

export class RemoAssetApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      query?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
    }
  ): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const hasBody = options?.body !== undefined && method !== 'GET' && method !== 'DELETE';
    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let data: unknown = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: string }).error)
          : `HTTP ${response.status}: ${text || response.statusText}`;
      throw new RemoAssetApiError(message);
    }

    return data as T;
  }
}

export function createApiClientFromEnv(): RemoAssetApiClient {
  const baseUrl = process.env.REMOASSET_API_URL?.trim();
  const apiKey = process.env.REMOASSET_API_KEY?.trim();

  if (!baseUrl) {
    throw new Error('REMOASSET_API_URL is required (e.g. https://YOUR_PROJECT.supabase.co/functions/v1/api)');
  }
  if (!apiKey) {
    throw new Error('REMOASSET_API_KEY is required — create one in RemoAsset Admin → API Keys');
  }

  return new RemoAssetApiClient(baseUrl, apiKey);
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

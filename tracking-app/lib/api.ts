export async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
  
    if (!res.ok) {
      const message = (data && (data.message || data.error)) || res.statusText;
      throw new Error(message);
    }
    return data as T;
  }
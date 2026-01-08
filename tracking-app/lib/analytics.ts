// lib/analytics.ts
type AnalyticsParams = Record<string, any>;

export function track(event: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;

  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push({
    event,
    ...params,
  });
}

import type { MetadataRoute } from "next";

const BASE_URL = "https://tracking.mfn.pt";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/orcamentos/novo`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
  ];
}

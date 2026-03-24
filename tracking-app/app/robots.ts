import type { MetadataRoute } from "next";

const BASE_URL = "https://tracking.mfn.pt";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/orcamentos/novo",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/pedido/",
          "/orcamentos/sucesso",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

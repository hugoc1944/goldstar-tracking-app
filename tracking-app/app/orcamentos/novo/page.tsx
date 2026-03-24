// app/orcamentos/novo/page.tsx (SERVER COMPONENT — NO "use client")

import type { Metadata } from "next";
import NewBudgetPage from "./PageClient";

const BASE_URL = "https://tracking.mfn.pt";

export const metadata: Metadata = {
  title: "Orçamento para Resguardo de Duche por Medida",
  description:
    "Peça online o seu orçamento para resguardo ou box de duche Goldstar por medida. Vidro temperado, acabamentos, fabricação portuguesa. Resposta rápida.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${BASE_URL}/orcamentos/novo`,
  },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: `${BASE_URL}/orcamentos/novo`,
    siteName: "Goldstar",
    title: "Orçamento para Resguardo de Duche por Medida | Goldstar",
    description:
      "Solicite online um orçamento personalizado para o seu resguardo ou box de duche Goldstar. Fabricação portuguesa, vidro temperado, múltiplos acabamentos.",
    images: [
      {
        url: `${BASE_URL}/brand/logo-trackingapp_dark.png`,
        width: 260,
        height: 60,
        alt: "Goldstar — Resguardos de Duche",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Orçamento para Resguardo de Duche | Goldstar",
    description:
      "Peça online o seu orçamento para resguardo de duche por medida. Goldstar - fabricação portuguesa.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "Goldstar",
      url: "https://mfn.pt",
      contactPoint: {
        "@type": "ContactPoint",
        email: "suporte@mfn.pt",
        contactType: "customer support",
        availableLanguage: "Portuguese",
      },
    },
    {
      "@type": "Service",
      "@id": `${BASE_URL}/orcamentos/novo#service`,
      name: "Orçamento para Resguardo de Duche por Medida",
      description:
        "Serviço de orçamentação online para resguardos e boxes de duche por medida. Inclui escolha de modelo, acabamento, tipo de vidro e opções de entrega ou instalação.",
      provider: { "@id": `${BASE_URL}/#organization` },
      areaServed: { "@type": "Country", name: "Portugal" },
      serviceType: "Resguardo de Duche",
      url: `${BASE_URL}/orcamentos/novo`,
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        seller: { "@id": `${BASE_URL}/#organization` },
      },
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NewBudgetPage />
    </>
  );
}
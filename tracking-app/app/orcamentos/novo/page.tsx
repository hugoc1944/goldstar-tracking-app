// app/orcamentos/novo/page.tsx (SERVER COMPONENT — NO "use client")

export const metadata = {
  title: "Pedir Orçamento GOLDSTAR | MFN",
  description:
    "Peça o seu orçamento personalizado para um resguardo GOLDSTAR. Seleccione modelo, medidas e opções e receba um orçamento rápido.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://tracking.mfn.pt/orcamentos/novo",
  },
  openGraph: {
    title: "Pedir Orçamento GOLDSTAR",
    description: "Formulário oficial de pedido de orçamento GOLDSTAR.",
    url: "https://tracking.mfn.pt/orcamentos/novo",
    siteName: "MFN",
  },
};

import NewBudgetPage from "./PageClient";

export default function Page() {
  return <NewBudgetPage />;
}
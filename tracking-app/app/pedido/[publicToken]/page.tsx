// app/pedido/[publicToken]/page.tsx (SERVER COMPONENT)
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import PageClient from "./PageClient";

export default function Page({ params }: { params: { publicToken: string } }) {
  return <PageClient params={params} />;
}

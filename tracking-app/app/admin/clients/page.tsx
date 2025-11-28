// app/admin/clients/page.tsx
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import ClientsPage from "./PageClient";

export default function Page() {
  return <ClientsPage />;
}

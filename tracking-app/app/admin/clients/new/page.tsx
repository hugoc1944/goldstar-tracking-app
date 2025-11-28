// app/admin/clients/new/page.tsx
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import NewClientPage from "./PageClient";

export default function Page() {
  return <NewClientPage />;
}

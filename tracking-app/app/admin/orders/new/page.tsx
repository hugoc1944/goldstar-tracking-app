// app/admin/orders/new/page.tsx
export const metadata = {
  robots: { index: false, follow: false },
};

import NewOrderPageClient from "./PageClient";

export default function Page() {
  return <NewOrderPageClient />;
}

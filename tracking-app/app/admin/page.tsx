// app/admin/page.tsx
// SERVER COMPONENT — do NOT add "use client"

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import AdminHomePage from "./PageClient";

export default function Page() {
  return <AdminHomePage />;
}

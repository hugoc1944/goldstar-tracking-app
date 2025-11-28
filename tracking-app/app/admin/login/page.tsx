// app/admin/login/page.tsx
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import AdminLoginPage from "./PageClient";

export default function Page() {
  return <AdminLoginPage />;
}
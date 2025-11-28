// app/admin/arquivos/page.tsx
export const metadata = {
  robots: { index: false, follow: false },
};

import ArchivesPage from "./PageClient";

export default function Page() {
  return <ArchivesPage />;
}

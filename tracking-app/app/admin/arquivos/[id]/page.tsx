// app/admin/arquivos/[id]/page.tsx
export const metadata = {
  robots: { index: false, follow: false },
};

import ArchiveDetail from "./PageClient";

export default function Page({ params }: { params: { id: string } }) {
  return <ArchiveDetail params={params} />;
}

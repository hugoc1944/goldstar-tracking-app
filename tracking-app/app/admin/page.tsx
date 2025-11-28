'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useMemo } from 'react';
import AdminShell from '@/components/admin/AdminShell';
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminHomePage() {
  const pathname = usePathname();
  const { data } = useSession();
  const displayName = useMemo(() => {
    const email = data?.user?.email ?? 'admin@goldstar.pt';
    return (data?.user?.name ?? email.split('@')[0]) || 'admin';
  }, [data]);

  return (
    <AdminShell>
      <main className="grid min-h-screen grid-cols-[260px_1fr] bg-background">
        {/* Content */}
        <section className="relative flex min-h-screen flex-col items-start justify-center px-10">
          <h1 className="text-6xl font-bold leading-tight text-foreground">Dashboard</h1>
          <p className="mt-4 text-4xl text-foreground">
            Bem vindo,{' '}
            <span className="text-primary">{displayName || 'admin'}</span>.
          </p>
        </section>
      </main>
    </AdminShell>
  );
}

/* ------------------------ small in-file components ------------------------ */

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-secondary text-foreground'
          : 'text-foreground hover:bg-muted/60',
      ].join(' ')}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Home, ClipboardList, Users, LogOut } from 'lucide-react';

function NavItem({
  href, label, icon, active,
}: { href: string; label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
        ${active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted/50'
        }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const displayName = 'Admin'; // optionally pull from session

  return (
    <>
      {/* Fixed sidebar (never scrolls away) */}
      <aside
        className="
          fixed inset-y-0 left-0 z-40 w-[260px]
          border-r border-border bg-white px-4 py-4
          hidden lg:flex flex-col
        "
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-2">
          <Image
            src="/brand/logo-trackingapp_dark.png"
            alt="Goldstar Tracking App"
            width={150}
            height={40}
            priority
          />
        </div>

        {/* Nav */}
        <nav className="mt-3 flex flex-1 flex-col gap-1">
          <NavItem
            href="/admin"
            label="Dashboard"
            icon={<Home size={18} />}
            active={pathname === '/admin'}
          />
          <NavItem
            href="/admin/orders"
            label="Pedidos"
            icon={<ClipboardList size={18} />}
            active={pathname?.startsWith('/admin/orders')}
          />
          <NavItem
            href="/admin/clients"
            label="Clientes"
            icon={<Users size={18} />}
            active={pathname?.startsWith('/admin/clients')}
          />
        </nav>

        {/* User + logout */}
        <div className="mt-auto">
          <div className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              {displayName?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
              <div className="truncate text-xs text-muted-foreground">GOLDSTAR</div>
            </div>
            <button
              type="button"
              className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-muted/60"
              onClick={() => signOut({ callbackUrl: '/admin/login' })}
              title="Terminar sessão"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Scrollable content area.
         On large screens we add left padding equal to the sidebar width. */}
      <section
        className="
          min-h-screen bg-background
          lg:pl-[260px]
        "
      >
        {/* This wrapper gives the page its own vertical scroll separate from the fixed sidebar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </section>
    </>
  );
}

'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.ok) router.push('/admin');
    else setErr('Credenciais inválidas.');
  }

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* LEFT: brand panel */}
      <section className="relative hidden text-white md:block" style={{ backgroundColor: '#333333' }}>
        {/* decorative PNG @ 12% opacity */}
        <div className="absolute inset-0">
          <Image
            src="/brand/login-art.png"
            alt=""
            fill
            priority
            className="object-cover object-center"
            style={{ opacity: 0.12 }}
          />
        </div>

        <div className="relative flex h-full flex-col px-10 py-12">
          {/* logo */}
          <div className="mb-10">
            <Image
              src="/brand/logo-trackingapp.png"
              alt="GOLDSTAR Tracking App"
              width={240}
              height={60}
              priority
            />
          </div>

          {/* welcome copy */}
          <div className="mt-6">
            <h1 className="text-5xl font-bold leading-tight">
              Bem-vindo
              <br />
              Admin<span className="align-super">👋</span>
            </h1>
            <p className="mt-6 max-w-md text-base/6 text-white/85">
              Sistema de acompanhamento de pedidos exclusivo GOLDSTAR.
            </p>
          </div>

          {/* footer left */}
          <div className="mt-auto text-xs text-white/70">
            MFN LDA © {new Date().getFullYear()}. Todos os Direitos Reservados.
          </div>
        </div>
      </section>

      {/* RIGHT: login form */}
      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <header className="mb-6">
            <p className="text-sm tracking-wider text-muted-foreground">GOLDSTAR</p>
            <h2 className="mt-1 text-3xl font-semibold text-foreground">Login</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Não se lembra das credenciais? <br />
              Contacte a webtogo.
            </p>
          </header>

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Username</span>
              <input
                type="email"
                placeholder="admin@exemplo.pt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Password</span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
              />
            </label>

            {err && <p className="text-sm text-destructive">{err}</p>}

            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Entrar na dashboard
            </button>
          </form>

          <div className="mt-10 text-right text-xs text-muted-foreground">
            Powered by{' '}
            <a
              className="underline hover:opacity-80"
              href="https://webtogo.pt"
              target="_blank"
              rel="noreferrer"
            >
              webtogo.pt
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
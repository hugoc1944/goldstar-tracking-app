import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Opt out of static rendering and caching (safe for success pages with query params)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Tiny client logger to print the id in the browser console (optional)
function ClientLogger({ id }: { id?: string | null }) {
  'use client';
  React.useEffect(() => {
    if (id) console.log('[Orçamento enviado] id:', id);
  }, [id]);
  return null;
}

function shortRef(id?: string | null) {
  return id ? `#${id.slice(0, 4)}` : '—';
}

export default function BudgetSuccessPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const id = searchParams?.id ?? null;

  return (
    <main className="mx-auto max-w-4xl p-6 md:p-8">
      {/* optional console.log in client */}
      <ClientLogger id={id} />

      {/* Top bar with logo */}
      <div className="mb-5 flex items-center gap-4">
        <Image
          src="/brand/logo-simulador_dark.png"
          alt="Goldstar"
          width={260}
          height={60}
          priority
          className="h-[120px] w-auto"
        />
      </div>

      {/* Card with Goldstar glow */}
      <section
        className="rounded-2xl bg-white"
        style={{ boxShadow: '0 0 18px 1px rgba(192,134,37,0.18)' }}
      >
        <div className="border-b border-neutral-200 px-6 py-5">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Orçamento enviado com sucesso
          </h1>
        </div>

        <div className="px-6 py-8">
          <div className="mb-4 inline-flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
            {/* Check icon */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>
              Recebemos o seu pedido{' '}
              {id ? <span className="opacity-70">({shortRef(id)})</span> : null}.
            </span>
          </div>

          <p className="text-[15px] text-neutral-800">
            Obrigado pelo contacto. A nossa equipa irá rever o seu pedido e enviar-lhe o
            orçamento por email. Por favor <strong>esteja atento ao seu email durante a próxima semana</strong>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/orcamentos/novo"
              className="inline-flex h-11 items-center rounded-xl bg-black px-6 text-[15px] font-semibold text-white
                         hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-yellow-400/50
                         shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_8px_rgba(250,204,21,0.35)]"
            >
              Fazer novo orçamento
            </Link>
            <Link href="https://mfn.pt" className="text-yellow-700 hover:underline">
              Voltar à página inicial
            </Link>
          </div>

          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <p className="mb-1 font-medium">Não recebeu email?</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Verifique a pasta de spam.</li>
              <li>Confirme que o endereço de email inserido está correto.</li>
              <li>Se necessário, envie email para <a href="mailto:suporte@mfn.pt">suporte@mfn.pt</a></li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

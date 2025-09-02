'use client';

import { useEffect, useState } from 'react';

type Status = 'PREPARACAO'|'PRODUCAO'|'EXPEDICAO'|'ENTREGUE';
type Payload = {
  ref: string; status: Status; createdAt: string; eta?: string | null;
  events: { from: Status; to: Status; at: string }[];
  items: { description: string; quantity: number }[];
  model?: string; clientName?: string;
};

export default function PublicOrderPage({ params }:{ params:{ token:string }}) {
  const { token } = params;
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const r = await fetch(`/api/pedido/${token}/status`, { cache:'no-store' });
    if (!r.ok) { setErr('Pedido não encontrado.'); return; }
    setData(await r.json());
  }

  useEffect(()=>{ load(); const id = setInterval(load, 12000); return ()=>clearInterval(id); }, [token]);

  if (err) return <main className="page">{err}</main>;
  if (!data) return <main className="page">A carregar…</main>;

  return (
    <main className="page max-w-3xl">
      <h1 className="text-2xl font-semibold">Pedido {data.ref}</h1>
      <p className="text-sm text-muted mt-1">Estado atual: <b>{pt(data.status)}</b></p>
      {data.eta && <p className="text-sm mt-1">Data estimada de entrega: <b>{new Date(data.eta).toLocaleString('pt-PT')}</b></p>}

      <section className="mt-6">
        <h2 className="font-medium">Progresso</h2>
        <ol className="mt-2 space-y-2 text-sm">
          {data.events.map((e,i)=>(
            <li key={i} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-primary/70" />
              <span>{pt(e.from)} → <b>{pt(e.to)}</b></span>
              <span className="text-muted">({new Date(e.at).toLocaleString('pt-PT')})</span>
            </li>
          ))}
        </ol>
      </section>

      {data.items?.length ? (
        <section className="mt-6">
          <h2 className="font-medium">Itens</h2>
          <ul className="mt-2 text-sm">
            {data.items.map((it, i)=>(
              <li key={i}>• {it.description} <span className="text-muted">x{it.quantity}</span></li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function pt(s: string) {
  switch (s) {
    case 'PREPARACAO': return 'Em preparação';
    case 'PRODUCAO': return 'Em produção';
    case 'EXPEDICAO': return 'Em expedição';
    case 'ENTREGUE': return 'Entregue';
    default: return s;
  }
}

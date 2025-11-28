// app/admin/clients/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';

export default function NewClientPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [client, setClient] = useState({
    name: '',
    email: '',
    phone: '',
    nif: '',
    address: '',
    postal: '',
    city: '',
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || 'Falha a criar cliente');
      }
      router.push('/admin/clients');
    } catch (err: any) {
      alert(err?.message ?? 'Falha a criar cliente');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell>
      <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl space-y-10 pb-24">
        {/* Header */}
        <header className="pt-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Adicionar cliente</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Preencha os dados do novo cliente. Pode usá-lo mais tarde ao criar um pedido.
          </p>
        </header>

        {/* Dados do cliente (same styling as 'Novo Pedido') */}
        <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground">Dados do cliente</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome*" required value={client.name} onChange={(v) => setClient({ ...client, name: v })} />
            <Field label="Email*" type="email" required value={client.email} onChange={(v) => setClient({ ...client, email: v })} />
            <Field label="Telefone" value={client.phone} onChange={(v) => setClient({ ...client, phone: v })} />
            <Field label="NIF" value={client.nif} onChange={(v) => setClient({ ...client, nif: v })} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Textarea className="sm:col-span-2" label="Morada" rows={4} value={client.address} onChange={(v) => setClient({ ...client, address: v })} />
            <Field label="Código Postal" value={client.postal} onChange={(v) => setClient({ ...client, postal: v })} />
            <Field label="Localidade" value={client.city} onChange={(v) => setClient({ ...client, city: v })} />
          </div>
        </section>

        {/* Submit */}
        <div className="pt-2">
          <div className="flex items-center justify-center">
            <button
              disabled={submitting}
              className="w-full max-w-sm rounded-xl bg-primary px-4 py-3 text-center text-primary-foreground font-semibold shadow-sm hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? 'A criar…' : 'Criar Cliente'}
            </button>
          </div>
        </div>
      </form>
    </AdminShell>
  );
}

/* ---- Local UI bits (copied style from NewOrder) ---- */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <input
        className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <textarea
        rows={rows}
        className="block w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

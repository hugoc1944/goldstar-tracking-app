import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import Layout from './_Layout';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

export function BudgetAdminNotificationEmail({
  budgetId,
  customerName,
  customerEmail,
  customerPhone,
  city,
  modelKey,
}: {
  budgetId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  city?: string | null;
  modelKey?: string | null;
}) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    '';
  const adminUrl = `${base}/admin/orcamentos`;

  return (
    <Layout preview={`Novo pedido de orçamento — ${customerName}`}>

      <Text style={{ ...p, fontWeight: 700, fontSize: 16 }}>Novo pedido de orçamento</Text>

      <Text style={p}>
        Foi submetido um novo pedido de orçamento. Consulte os detalhes abaixo.
      </Text>

      {/* Client info card */}
      <Section style={{
        backgroundColor: '#F4F4F4',
        borderRadius: 4,
        padding: '16px 20px',
        margin: '0 0 24px 0',
      }}>
        <Text style={{ margin: '0 0 4px 0', fontSize: 11, color: '#888888', letterSpacing: '0.5px', fontWeight: 600 }}>
          ORÇAMENTO
        </Text>
        <Text style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#111111', fontFamily: 'monospace' }}>
          #{budgetId.slice(0, 8)}
        </Text>
        <Text style={{ margin: '0 0 6px 0', fontSize: 14, color: '#444444' }}>
          <strong>Nome:</strong> {customerName}
        </Text>
        <Text style={{ margin: '0 0 6px 0', fontSize: 14, color: '#444444' }}>
          <strong>Email:</strong> {customerEmail}
        </Text>
        {customerPhone && (
          <Text style={{ margin: '0 0 6px 0', fontSize: 14, color: '#444444' }}>
            <strong>Telefone:</strong> {customerPhone}
          </Text>
        )}
        {city && (
          <Text style={{ margin: '0 0 6px 0', fontSize: 14, color: '#444444' }}>
            <strong>Cidade:</strong> {city}
          </Text>
        )}
        {modelKey && (
          <Text style={{ margin: 0, fontSize: 14, color: '#444444' }}>
            <strong>Modelo:</strong> {modelKey}
          </Text>
        )}
      </Section>

      {base && (
        <Button
          href={adminUrl}
          style={{
            backgroundColor: '#111111',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 600,
            padding: '14px 28px',
            borderRadius: 4,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Abrir orçamentos
        </Button>
      )}

    </Layout>
  );
}

export default BudgetAdminNotificationEmail;

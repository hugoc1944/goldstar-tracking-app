import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import Layout from './_Layout';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

export function ClientMessageToAdminEmail({
  adminEmail,
  orderId,
  customerName,
  customerEmail,
  message,
}: {
  adminEmail: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  message: string;
}) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    '';
  const short = (orderId || '').slice(0, 4);
  const adminOrdersUrl = `${base}/admin/orders?q=${encodeURIComponent(short)}`;

  return (
    <Layout preview={`Nova mensagem do cliente — ${customerName}`}>

      <Text style={{ ...p, fontWeight: 700, fontSize: 16 }}>Nova mensagem de cliente</Text>

      {/* Order info card */}
      <Section style={{
        backgroundColor: '#F4F4F4',
        borderRadius: 4,
        padding: '16px 20px',
        margin: '0 0 24px 0',
      }}>
        <Text style={{ margin: '0 0 4px 0', fontSize: 11, color: '#888888', letterSpacing: '0.5px', fontWeight: 600 }}>
          PEDIDO
        </Text>
        <Text style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: 700, color: '#111111', fontFamily: 'monospace' }}>
          #{orderId.slice(0, 8)}
        </Text>
        <Text style={{ margin: '0 0 4px 0', fontSize: 14, color: '#444444' }}>
          <strong>Cliente:</strong> {customerName}
        </Text>
        <Text style={{ margin: 0, fontSize: 14, color: '#444444' }}>
          <strong>Email:</strong> {customerEmail}
        </Text>
      </Section>

      {/* Message block */}
      <Text style={{ ...p, margin: '0 0 10px 0', fontWeight: 600 }}>Mensagem:</Text>
      <Section style={{
        backgroundColor: '#F9F9F9',
        borderLeft: '3px solid #F5C200',
        padding: '16px 20px',
        margin: '0 0 24px 0',
      }}>
        <Text style={{ margin: 0, fontSize: 15, color: '#333333', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>
          {message}
        </Text>
      </Section>

      {base && (
        <Button
          href={adminOrdersUrl}
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
          Abrir no painel
        </Button>
      )}

    </Layout>
  );
}

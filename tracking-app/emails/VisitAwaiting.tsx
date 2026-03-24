import * as React from 'react';
import { Text, Button } from '@react-email/components';
import Layout from './_Layout';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

export function VisitAwaitingEmail({
  customerName,
  publicToken,
}: {
  customerName: string;
  publicToken: string;
}) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = `${base}/pedido/${publicToken}`;

  return (
    <Layout preview="Pedido confirmado — iremos agendar a visita do técnico">

      <Text style={p}>Olá {customerName},</Text>

      <Text style={p}>
        O seu pedido foi <strong>confirmado</strong>. Vamos entrar em contacto consigo
        brevemente para <strong>agendar a visita do nosso técnico</strong>.
      </Text>

      <Text style={p}>
        Pode acompanhar o estado do seu pedido em qualquer momento:
      </Text>

      <Button
        href={link}
        style={{
          backgroundColor: '#111111',
          color: '#ffffff',
          fontSize: 15,
          fontWeight: 600,
          padding: '14px 28px',
          borderRadius: 4,
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 24,
        }}
      >
        Acompanhar o meu pedido
      </Button>

      <Text style={{ ...p, margin: 0, color: '#555555' }}>
        Obrigado por escolher a GOLDSTAR.
      </Text>

    </Layout>
  );
}

export default VisitAwaitingEmail;

import * as React from 'react';
import { Text, Button } from '@react-email/components';
import Layout from './_Layout';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

export function OrderCreatedEmail({
  customerName,
  publicToken,
}: { customerName: string; publicToken: string }) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = `${base}/pedido/${publicToken}`;

  return (
    <Layout preview="O seu pedido foi criado com sucesso">

      <Text style={p}>Olá {customerName},</Text>

      <Text style={p}>O seu pedido foi criado com sucesso.</Text>

      <Text style={p}>Pode acompanhar o estado da encomenda a qualquer momento:</Text>

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
        Obrigado pela sua confiança,<br />
        Equipa GOLDSTAR
      </Text>

    </Layout>
  );
}

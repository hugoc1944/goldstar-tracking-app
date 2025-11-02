import * as React from 'react';
import { Text, Link, Button } from '@react-email/components';
import Layout from './_Layout';

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
    <Layout preview="Pedido confirmado — vamos agendar a visita do técnico">
      <Text>Olá {customerName},</Text>
      <Text>
        O seu pedido foi <b>confirmado</b>. Vamos entrar em contacto consigo o mais breve possível
        para <b>agendar a visita do nosso técnico</b>.
      </Text>
      <Button
        href={link}
        style={{
          backgroundColor: '#0a0a0a',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: 10,
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        Acompanhar o meu pedido
      </Button>
      <Text style={{ marginTop: 16 }}>
        Obrigado por escolher a GOLDSTAR.
      </Text>
    </Layout>
  );
}

export default VisitAwaitingEmail;

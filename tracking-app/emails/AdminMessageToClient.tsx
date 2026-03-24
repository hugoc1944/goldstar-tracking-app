import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import Layout from './_Layout';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

export function AdminMessageToClientEmail({
  customerName,
  message,
  publicToken,
}: { customerName: string; message: string; publicToken: string }) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = `${base}/pedido/${publicToken}`;

  return (
    <Layout preview="Nova mensagem da equipa GOLDSTAR sobre o seu pedido">

      <Text style={p}>Olá {customerName},</Text>

      <Text style={p}>Recebeu uma nova mensagem da nossa equipa:</Text>

      {/* Message block */}
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
        Ver o meu pedido
      </Button>

      <Text style={{ ...p, margin: 0, color: '#555555' }}>
        Obrigado pela sua confiança,<br />
        Equipa GOLDSTAR
      </Text>

    </Layout>
  );
}

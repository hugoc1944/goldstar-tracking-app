import * as React from 'react';
import { Text, Link, Button } from '@react-email/components';
import Layout from './_Layout';

type Status = 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';

export function OrderStatusChangedEmail({
  customerName,
  publicToken,
  newStatus,
  eta,            // ISO string or null
  trackingNumber, // string or null
}: {
  customerName: string;
  publicToken: string;
  newStatus: Status;
  eta?: string | null;
  trackingNumber?: string | null;
}) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = `${base}/pedido/${publicToken}`;
  const reviewUrl = 'https://share.google/4N1TqCU1MkdOvE98I';

  const statusLabel: Record<Status, string> = {
    PREPARACAO: 'Em preparação',
    PRODUCAO:   'Em produção',
    EXPEDICAO:  'Em expedição',
    ENTREGUE:   'Entregue',
  };

  return (
    <Layout preview={`O estado do seu pedido mudou para ${statusLabel[newStatus]}`}>
      <Text>Olá {customerName},</Text>
      <Text>
        O estado do seu pedido mudou para <b>{statusLabel[newStatus]}</b>.
      </Text>

      {newStatus === 'EXPEDICAO' && eta && (
        <Text>
          Entrega prevista: <b>{new Date(eta).toLocaleString()}</b>
        </Text>
      )}

      {trackingNumber && (
        <Text>
          Nº de tracking: <b>{trackingNumber}</b>
        </Text>
      )}

      {/* NEW: Review CTA when Entregue */}
      {newStatus === 'ENTREGUE' && (
        <>
          <Text style={{ marginTop: 14 }}>
            Se gostou do nosso serviço, o seu feedback é muito importante para nós.
            Deixe, por favor, a sua avaliação:
          </Text>
          <Button
            href={reviewUrl}
            style={{
              backgroundColor: '#FED619',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 10,
              boxShadow:
                '0 2px 10px rgba(0,0,0,0.25),0 0 8px rgba(250,204,21,0.35)',
              textDecoration: 'none',
              display: 'inline-block',
              marginTop: 6,
            }}
          >
            Deixar avaliação
          </Button>
        </>
      )}

      <Text style={{ marginTop: 16 }}>
        Pode acompanhar o seu pedido aqui:{' '}
        <Link href={link}>{link}</Link>
      </Text>

      <Text style={{ marginTop: 16 }}>Obrigado!</Text>
    </Layout>
  );
}

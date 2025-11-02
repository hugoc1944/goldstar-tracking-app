// emails/VisitScheduled.tsx
import * as React from 'react';
import { Text, Button } from '@react-email/components';
import Layout from './_Layout';

export function VisitScheduledEmail({
  customerName,
  visitAtISO,
  publicLink,
}: {
  customerName: string;
  visitAtISO: string;   // ISO string (required here)
  publicLink: string;
}) {
  const dt = new Date(visitAtISO);
  const when = isNaN(dt.getTime())
    ? visitAtISO
    : new Intl.DateTimeFormat('pt-PT', { dateStyle: 'full', timeStyle: 'short' }).format(dt);

  return (
    <Layout preview={`Visita técnica agendada — ${when}`}>
      <Text>Olá {customerName},</Text>

      <Text>
        Só para relembrar: a nossa equipa técnica irá visitá-lo <b>{when}</b>.
      </Text>

      <Button
        href={publicLink}
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
        Se precisar de reagendar, por favor entre em contacto via telefónia.
      </Text>

      <Text style={{ color: '#525252' }}>
        Obrigado por escolher a GOLDSTAR.
      </Text>
    </Layout>
  );
}

export default VisitScheduledEmail;

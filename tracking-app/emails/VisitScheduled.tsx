// emails/VisitScheduled.tsx
import * as React from 'react';
import { Text, Button } from '@react-email/components';
import Layout from './_Layout';

export function VisitScheduledEmail({
  customerName,
  visitAtISO,
  visitPeriod,
  publicLink,
}: {
  customerName: string;
  visitAtISO: string;        // ISO date (yyyy-mm-dd or ISO)
  visitPeriod: 'MANHA' | 'TARDE';
  publicLink: string;
}) {
  const dt = new Date(visitAtISO);

  const formattedDate = isNaN(dt.getTime())
    ? visitAtISO
    : new Intl.DateTimeFormat('pt-PT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dt);

  const periodNode =
  visitPeriod === 'MANHA' ? (
    <>
      <b>no período da manhã</b> (entre as 08:30h e as 13:00h)
    </>
  ) : (
    <>
      <b>no período da tarde</b> (entre as 14:00h e as 18:00h)
    </>
  );

  return (
    <Layout preview={`Visita técnica agendada — ${formattedDate}`}>
      <Text>Olá {customerName},</Text>

      <Text>
        Informamos que a nossa equipa técnica irá visitá-lo{' '}
        <b>{formattedDate}</b>, {periodNode}.
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
        Caso este período não seja conveniente para si, solicitamos que entre em
        contacto connosco através do <b>+351 232 599 209</b> (rede fixa nacional),
        para que possamos proceder ao respetivo reagendamento.
      </Text>

      <Text style={{ color: '#525252' }}>
        Obrigado por escolher a GOLDSTAR.
      </Text>
    </Layout>
  );
}

export default VisitScheduledEmail;

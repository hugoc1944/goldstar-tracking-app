// emails/VisitScheduled.tsx
import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import Layout from './_Layout';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

export function VisitScheduledEmail({
  customerName,
  visitAtISO,
  visitPeriod,
  publicLink,
}: {
  customerName: string;
  visitAtISO: string;
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

  const periodLabel =
    visitPeriod === 'MANHA'
      ? 'no período da manhã (entre as 08:30h e as 13:00h)'
      : 'no período da tarde (entre as 14:00h e as 18:00h)';

  return (
    <Layout preview={`Visita técnica agendada — ${formattedDate}`}>

      <Text style={p}>Olá {customerName},</Text>

      <Text style={p}>
        Informamos que a nossa equipa técnica irá visitá-lo na data indicada abaixo:
      </Text>

      {/* Date/period callout */}
      <Section style={{
        backgroundColor: '#FFFBEA',
        border: '1px solid #F5C200',
        borderRadius: 4,
        padding: '16px 20px',
        margin: '0 0 24px 0',
      }}>
        <Text style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#111111' }}>
          {formattedDate}
        </Text>
        <Text style={{ margin: 0, fontSize: 14, color: '#555555' }}>
          {periodLabel}
        </Text>
      </Section>

      <Button
        href={publicLink}
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

      <Text style={p}>
        Caso este período não seja conveniente, contacte-nos através do{' '}
        <strong>+351 232 599 209</strong> (rede fixa nacional) para reagendar.
      </Text>

      <Text style={{ ...p, margin: 0, color: '#555555' }}>
        Obrigado por escolher a GOLDSTAR.
      </Text>

    </Layout>
  );
}

export default VisitScheduledEmail;

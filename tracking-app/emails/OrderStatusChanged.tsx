import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import Layout from './_Layout';

type Status = 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

const statusLabel: Record<Status, string> = {
  PREPARACAO: 'Em preparação',
  PRODUCAO:   'Em produção',
  EXPEDICAO:  'Em expedição',
  ENTREGUE:   'Entregue',
};

const statusBadge: Record<Status, { bg: string; color: string }> = {
  PREPARACAO: { bg: '#FFF8E1', color: '#92400E' },
  PRODUCAO:   { bg: '#EFF6FF', color: '#1E40AF' },
  EXPEDICAO:  { bg: '#F0FDF4', color: '#166534' },
  ENTREGUE:   { bg: '#F4F4F4', color: '#111111' },
};

export function OrderStatusChangedEmail({
  customerName,
  publicToken,
  newStatus,
  eta,
  expeditionPeriod,
  trackingNumber,
}: {
  customerName: string;
  publicToken: string;
  newStatus: Status;
  eta?: string | null;
  expeditionPeriod?: 'MANHA' | 'TARDE' | null;
  trackingNumber?: string | null;
}) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = `${base}/pedido/${publicToken}`;
  const reviewUrl = 'https://share.google/4N1TqCU1MkdOvE98I';

  const formattedEta =
    eta && !isNaN(new Date(eta).getTime())
      ? new Intl.DateTimeFormat('pt-PT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(eta))
      : null;

  const expeditionPeriodLabel =
    expeditionPeriod === 'MANHA'
      ? 'no período da manhã (entre as 08:30h e as 13:00h)'
      : expeditionPeriod === 'TARDE'
      ? 'no período da tarde (entre as 14:00h e as 18:00h)'
      : null;

  const badge = statusBadge[newStatus];

  return (
    <Layout preview={`O estado do seu pedido mudou para ${statusLabel[newStatus]}`}>

      <Text style={p}>Olá {customerName},</Text>

      <Text style={{ ...p, margin: '0 0 20px 0' }}>
        O estado do seu pedido foi atualizado:
      </Text>

      {/* Status badge */}
      <Section style={{
        backgroundColor: badge.bg,
        borderRadius: 4,
        padding: '14px 20px',
        margin: '0 0 24px 0',
      }}>
        <Text style={{ margin: 0, fontSize: 16, fontWeight: 700, color: badge.color }}>
          {statusLabel[newStatus]}
        </Text>
      </Section>

      {newStatus === 'EXPEDICAO' && formattedEta && (
        <Text style={p}>
          Entrega prevista para <strong>{formattedEta}</strong>
          {expeditionPeriodLabel ? `, ${expeditionPeriodLabel}` : ''}.
        </Text>
      )}

      {newStatus === 'EXPEDICAO' && formattedEta && (
        <Text style={p}>
          Caso não esteja disponível neste período, contacte-nos através do{' '}
          <strong>+351 232 599 209</strong> (rede fixa nacional) para reagendar.
        </Text>
      )}

      {trackingNumber && (
        <Text style={p}>
          Número de tracking: <strong>{trackingNumber}</strong>
        </Text>
      )}

      {newStatus === 'ENTREGUE' && (
        <>
          <Text style={p}>
            Agradecemos a sua confiança. Se gostou do nosso serviço, ficamos muito gratos pela sua avaliação:
          </Text>
          <Button
            href={reviewUrl}
            style={{
              backgroundColor: '#F5C200',
              color: '#111111',
              fontSize: 15,
              fontWeight: 700,
              padding: '14px 28px',
              borderRadius: 4,
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: 24,
            }}
          >
            Deixar avaliação
          </Button>
        </>
      )}

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

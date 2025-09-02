import * as React from 'react';
import { Text, Link } from '@react-email/components';
import Layout from './_Layout';

type Status = 'PREPARACAO'|'PRODUCAO'|'EXPEDICAO'|'ENTREGUE';

export function OrderStatusChangedEmail({
  customerName,
  publicToken,
  newStatus,
  eta, // ISO string or null
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

  const statusLabel: Record<Status,string> = {
    PREPARACAO: 'Em preparação',
    PRODUCAO: 'Em produção',
    EXPEDICAO: 'Em expedição',
    ENTREGUE: 'Entregue',
  };

  return (
    <Layout preview={`O estado do seu pedido mudou para ${statusLabel[newStatus]}`}>
      <Text>Olá {customerName},</Text>
      <Text>O estado do seu pedido mudou para <b>{statusLabel[newStatus]}</b>.</Text>
      {newStatus === 'EXPEDICAO' && eta && (
        <Text>Entrega prevista: <b>{new Date(eta).toLocaleString()}</b></Text>
      )}
      {trackingNumber && <Text>Nº de tracking: <b>{trackingNumber}</b></Text>}
      <Text>Consulte sempre aqui: <Link href={link}>{link}</Link></Text>
      <Text style={{ marginTop: 16 }}>Obrigado!</Text>
    </Layout>
  );
}

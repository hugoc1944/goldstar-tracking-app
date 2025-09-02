import * as React from 'react';
import { Text } from '@react-email/components';
import Layout from './_Layout';

export function ClientMessageToAdminEmail({
  adminEmail,
  orderId,
  customerName,
  customerEmail,
  message,
}: {
  adminEmail: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  message: string;
}) {
  return (
    <Layout preview={`Nova mensagem do cliente (${customerName})`}>
      <Text>Para: {adminEmail}</Text>
      <Text>Pedido: #{orderId}</Text>
      <Text>Cliente: {customerName} &lt;{customerEmail}&gt;</Text>
      <Text style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{message}</Text>
    </Layout>
  );
}

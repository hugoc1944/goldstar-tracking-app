import * as React from 'react';
import { Text, Link } from '@react-email/components';
import Layout from './_Layout';

export function OrderCreatedEmail({
  customerName,
  publicToken,
}: { customerName: string; publicToken: string }) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = `${base}/pedido/${publicToken}`;

  return (
    <Layout preview="O seu pedido foi criado">
      <Text>Olá {customerName},</Text>
      <Text>O seu pedido foi criado com sucesso.</Text>
      <Text>Pode acompanhar o estado no link abaixo:</Text>
      <Link href={link}>{link}</Link>
      <Text style={{ marginTop: 16 }}>Obrigado!</Text>
    </Layout>
  );
}

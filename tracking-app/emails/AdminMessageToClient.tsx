import * as React from 'react';
import { Text, Link } from '@react-email/components';
import Layout from './_Layout';

export function AdminMessageToClientEmail({
  customerName,
  message,
  publicToken,
}: { customerName: string; message: string; publicToken: string }) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = `${base}/pedido/${publicToken}`;

  return (
    <Layout preview="Nova mensagem do suporte">
      <Text>Olá {customerName},</Text>
      <Text>Recebeu uma nova mensagem do suporte:</Text>
      <Text style={{ whiteSpace: 'pre-wrap' }}>{message}</Text>
      <Text>Ver o seu pedido: <Link href={link}>{link}</Link></Text>
    </Layout>
  );
}

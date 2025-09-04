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

  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    ''; // e.g. https://tracking.mfn.pt
  const short = (orderId || '').slice(0, 4); // "91ce"
  const adminOrdersUrl = `${base}/admin/orders?q=${encodeURIComponent(short)}`;

  return (
    <Layout preview={`Nova mensagem do cliente (${customerName})`}>
      <Text>Para: {adminEmail}</Text>
      <Text>
        Pedido: <strong>#{orderId}</strong>
      </Text>

      {/* 🔗 New: direct link to Orders page with query */}
      {base ? (
        <Text>
          Abrir no painel:&nbsp;
          <a
            href={adminOrdersUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#2563eb', textDecoration: 'underline' }}
          >
            {adminOrdersUrl}
          </a>
        </Text>
      ) : null}

      <Text>
        Cliente: {customerName} &lt;{customerEmail}&gt;
      </Text>
      <Text style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>Mensagem: {message}</Text>
    </Layout>
  );
}

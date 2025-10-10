import * as React from 'react';
import { Text, Link } from '@react-email/components';
import Layout from './_Layout';

export function BudgetSentEmail({
  customerName,
  budgetId,
  pdfUrl,           // public URL to the generated PDF (optional)
}: { customerName: string; budgetId: string; pdfUrl?: string }) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const viewLink = `${base}/admin/orcamentos/${budgetId}`;

  return (
    <Layout preview="O seu orçamento GOLDSTAR">
      <Text>Olá {customerName},</Text>
      <Text>
        Obrigado pelo seu pedido. Em anexo segue a sua proposta de orçamento GOLDSTAR.
      </Text>
      {pdfUrl ? (
        <>
          <Text>Pode também descarregar a proposta através deste link:</Text>
          <Link href={pdfUrl}>{pdfUrl}</Link>
        </>
      ) : null}
      <Text style={{ marginTop: 16 }}>
        Caso tenha dúvidas ou pretenda avançar, responda a este email.
      </Text>
      <Text style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
        (Para a nossa equipa: ver no backoffice em <Link href={viewLink}>{viewLink}</Link>)
      </Text>
      <Text style={{ marginTop: 16 }}>Obrigado!</Text>
    </Layout>
  );
}

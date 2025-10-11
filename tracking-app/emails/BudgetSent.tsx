// emails/BudgetSent.tsx
import * as React from 'react';
import { Text, Link } from '@react-email/components';
import Layout from './_Layout';

export function BudgetSentEmail({
  customerName,
  confirmUrl,
  pdfUrl,
  backofficeUrl,
}: {
  customerName: string;
  confirmUrl: string;
  pdfUrl?: string;
  backofficeUrl?: string;
}) {
  return (
    <Layout preview="Confirme o seu orçamento">
      <Text>Olá {customerName},</Text>
      <Text>Anexámos a sua proposta de orçamento GOLDSTAR.</Text>
      <Text>Para avançarmos com a produção, confirme por favor:</Text>

      {/* CTA button — inline styles for broad email client support */}
      <a
        href={confirmUrl}
        style={{
          backgroundColor: '#000',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: 10,
          display: 'inline-block',
          textDecoration: 'none',
          boxShadow:
            '0 2px 10px rgba(0,0,0,0.25), 0 0 8px rgba(250,204,21,0.35)',
        }}
      >
        Confirmar o Orçamento
      </a>


      <Text style={{ marginTop: 16 }}>Obrigado!</Text>

      {backofficeUrl && (
        <Text style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
          (Backoffice: <Link href={backofficeUrl}>{backofficeUrl}</Link>)
        </Text>
      )}
    </Layout>
  );
}

export default BudgetSentEmail;

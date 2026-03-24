// emails/BudgetSent.tsx
import * as React from 'react';
import { Text, Button, Section } from '@react-email/components';
import Layout from './_Layout';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

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
    <Layout preview="O seu orçamento está pronto — confirme para avançar com a produção">

      <Text style={p}>Olá {customerName},</Text>

      <Text style={p}>
        O seu orçamento GOLDSTAR está pronto. O PDF com todos os detalhes foi enviado em anexo a este email.
      </Text>

      {/* Instruction callout */}
      <Section style={{
        backgroundColor: '#FFFBEA',
        border: '1px solid #F5C200',
        borderRadius: 4,
        padding: '16px 20px',
        margin: '0 0 28px 0',
      }}>
        <Text style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111111', lineHeight: '1.5' }}>
          Para confirmar o orçamento e avançar com a produção, clique no botão abaixo:
        </Text>
      </Section>

      {/* Primary CTA — gold, prominent */}
      <Button
        href={confirmUrl}
        style={{
          backgroundColor: '#F5C200',
          color: '#111111',
          fontSize: 16,
          fontWeight: 700,
          padding: '16px 40px',
          borderRadius: 4,
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 24,
        }}
      >
        Confirmar o meu Orçamento →
      </Button>

      {/* Clarification note */}
      <Text style={{ fontSize: 13, color: '#888888', margin: '0 0 28px 0', lineHeight: '1.6' }}>
        Por favor não utilize a resposta deste email para confirmar — utilize o botão acima.
        Em caso de dúvida, pode responder a este email e a nossa equipa irá contactá-lo.
      </Text>

      <Text style={{ ...p, margin: 0, color: '#555555' }}>
        Obrigado pela sua confiança,<br />
        Equipa GOLDSTAR
      </Text>

    </Layout>
  );
}

export default BudgetSentEmail;

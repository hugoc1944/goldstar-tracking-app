import * as React from 'react';
import { Text } from '@react-email/components';
import Layout from './_Layout';

const p: React.CSSProperties = { fontSize: 15, color: '#333333', lineHeight: '1.65', margin: '0 0 16px 0' };

export function BudgetReceivedEmail({
  customerName,
}: {
  customerName: string;
}) {
  return (
    <Layout preview="Recebemos o seu pedido de orçamento">

      <Text style={p}>Olá {customerName},</Text>

      <Text style={p}>
        Recebemos o seu pedido de orçamento. A nossa equipa vai analisá-lo com atenção
        e enviar-lhe uma proposta por email em breve.
      </Text>

      <Text style={p}>
        Se não receber o email na sua caixa de entrada, verifique a pasta de spam
        ou contacte-nos respondendo a esta mensagem.
      </Text>

      <Text style={{ ...p, margin: 0, color: '#555555' }}>
        Obrigado pela sua confiança,<br />
        Equipa GOLDSTAR
      </Text>

    </Layout>
  );
}

export default BudgetReceivedEmail;

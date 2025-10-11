import * as React from 'react';
import { Text } from '@react-email/components';
import Layout from './_Layout';

export function BudgetReceivedEmail({
  customerName,
}: {
  customerName: string;
}) {
  return (
    <Layout preview="Recebemos o seu pedido de orçamento">
      <Text>Olá {customerName},</Text>
      <Text>
        Recebemos o seu pedido de orçamento e a nossa equipa vai analisá-lo com
        atenção. Iremos enviar o orçamento por email em breve.
      </Text>
      <Text style={{ marginTop: 16 }}>
        Se não receber o email, confirme a pasta de spam ou contacte-nos.
      </Text>
      <Text style={{ marginTop: 16 }}>Obrigado!</Text>
    </Layout>
  );
}

export default BudgetReceivedEmail;

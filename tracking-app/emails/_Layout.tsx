import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Text, Hr, Link } from '@react-email/components';

export default function Layout({
  preview,
  children,
}: React.PropsWithChildren<{ preview: string }>) {
  return (
    <Html lang="pt-PT">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f6f6f8', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
        <Container style={{ maxWidth: 620, margin: '24px auto', background: '#fff', borderRadius: 12, padding: 24 }}>
          <Section>
            <Text style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>GOLDSTAR • Tracking</Text>
            <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Atualizações do seu pedido</Text>
          </Section>
          <Hr />
          <Section>{children}</Section>
          <Hr />
          <Section>
            <Text style={{ fontSize: 12, color: '#888' }}>
              Esta é uma mensagem automática. Em caso de dúvida, responda a este email.
            </Text>
            <Text style={{ fontSize: 12, color: '#888' }}>
              © {new Date().getFullYear()} GOLDSTAR • <Link href={process.env.NEXTAUTH_URL || '#'}>tracking</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

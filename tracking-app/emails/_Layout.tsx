import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Text } from '@react-email/components';

export default function Layout({
  preview,
  children,
}: React.PropsWithChildren<{ preview: string }>) {
  return (
    <Html lang="pt-PT">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{
        backgroundColor: '#EBEBEB',
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        margin: 0,
        padding: 0,
      }}>
        <Container style={{ maxWidth: 600, margin: '32px auto 48px auto' }}>

          {/* Gold brand header */}
          <Section style={{ backgroundColor: '#F5C200', padding: '20px 40px' }}>
            <Text style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111111', letterSpacing: '1px' }}>
              GOLDSTAR
            </Text>
          </Section>

          {/* White content area */}
          <Section style={{ backgroundColor: '#FFFFFF', padding: '36px 40px 40px 40px' }}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: '#F4F4F4', padding: '20px 40px' }}>
            <Text style={{ margin: '0 0 4px 0', fontSize: 12, color: '#888888', lineHeight: '1.5' }}>
              Este é um email automático gerado pelo sistema GOLDSTAR.
            </Text>
            <Text style={{ margin: 0, fontSize: 12, color: '#AAAAAA' }}>
              © {new Date().getFullYear()} GOLDSTAR
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

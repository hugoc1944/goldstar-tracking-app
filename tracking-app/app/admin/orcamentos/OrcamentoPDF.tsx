import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const brandGold = '#C08625';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, color: '#111' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  logo: { width: 160, height: 44, marginRight: 10 },
  title: { fontSize: 18, fontWeight: 700 },
  card: { marginBottom: 10, border: '1pt solid #e5e7eb', borderRadius: 6 },
  cardHead: { backgroundColor: '#faf7f1', borderBottom: '1pt solid #e5e7eb', padding: 8 },
  cardHeadText: { fontSize: 12, fontWeight: 700, color: brandGold },
  cardBody: { padding: 10, gap: 4 },
  row: { marginBottom: 2 },
  bold: { fontWeight: 700 },
});

export function OrcamentoPDF({ b }: { b: any }) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const logoUrl = `${base}/brand/logo-trackingapp_dark.png`;

  const eur = (c?: number) =>
    typeof c === 'number' ? (c / 100).toFixed(2) + ' €' : '—';

  const total = ((b.priceCents ?? 0) + (b.installPriceCents ?? 0)) / 100;

  const deliveryText =
    b.deliveryType === 'entrega_instalacao' || b.deliveryType === 'instalacao'
      ? 'Entrega + Instalação'
      : 'Entrega';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with logo & title */}
        <View style={styles.header}>
          <Image src={logoUrl} style={styles.logo} />
          <Text style={styles.title}>Orçamento GOLDSTAR</Text>
        </View>

        {/* Cliente */}
        <View style={styles.card}>
          <View style={styles.cardHead}><Text style={styles.cardHeadText}>Cliente</Text></View>
          <View style={styles.cardBody}>
            <Text>{b.name}</Text>
            <Text>{b.email}</Text>
            <Text>{b.address}, {b.postalCode} {b.city}</Text>
            {b.nif ? <Text>NIF: {b.nif}</Text> : null}
          </View>
        </View>

        {/* Detalhes */}
        <View style={styles.card}>
          <View style={styles.cardHead}><Text style={styles.cardHeadText}>Detalhes do Produto</Text></View>
          <View style={styles.cardBody}>
            <Text>Modelo: <Text style={styles.bold}>{b.modelKey}</Text></Text>
            <Text>Acabamento: {b.finishKey}</Text>
            <Text>Vidro: {b.glassTypeKey}</Text>
            <Text>Complemento: {b.complemento}</Text>
            {b.barColor && <Text>Vision — Barra: {b.barColor}</Text>}
            {b.visionSupport && <Text>Vision — Suporte: {b.visionSupport}</Text>}
            {!!b.widthMm && !!b.heightMm && (
              <Text>Medidas: {b.widthMm} × {b.heightMm}{b.depthMm ? ` × ${b.depthMm}` : ''} mm</Text>
            )}
            {b.willSendLater && <Text>Medidas: a indicar pelo cliente</Text>}
            {b.notes ? <Text>Notas: {b.notes}</Text> : null}
          </View>
        </View>

        {/* Entrega / Instalação */}
        <View style={styles.card}>
          <View style={styles.cardHead}><Text style={styles.cardHeadText}>Entrega / Instalação</Text></View>
          <View style={styles.cardBody}>
            <Text>Tipo: {deliveryText}</Text>
            {b.housingType ? <Text>Habitação: {b.housingType}</Text> : null}
            {typeof b.floorNumber === 'number' ? <Text>Andar: {b.floorNumber}</Text> : null}
            {typeof b.hasElevator === 'boolean' ? (
              <Text>Elevador: {b.hasElevator ? 'Sim' : 'Não'}</Text>
            ) : null}
          </View>
        </View>

        {/* Valores */}
        <View style={styles.card}>
          <View style={styles.cardHead}><Text style={styles.cardHeadText}>Valores</Text></View>
          <View style={styles.cardBody}>
            <Text>Preço: {eur(b.priceCents)}</Text>
            <Text>Custo Instalação: {eur(b.installPriceCents)}</Text>
            <Text>Total: <Text style={styles.bold}>{total.toFixed(2)} €</Text></Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

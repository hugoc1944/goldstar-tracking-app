import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';

const brandGold = '#FCCC1A';

// ---- helpers to humanize values ----
const titleCase = (s: string) =>
  s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function humanModel(key?: string | null) {
  if (!key) return '—';
  const k = String(key).toLowerCase().replace(/-/g, '_');
  const m = k.match(/_v(\d+)$/);
  const base = titleCase(k.replace(/_v\d+$/, ''));
  return m ? `${base} Variação ${m[1]}` : base;
}

function humanHandle(v?: string | null) {
  if (!v) return '—';
  const m = String(v).match(/^h(\d)$/i);
  return m ? `Handle ${m[1]}` : titleCase(String(v));
}

function humanComplemento(v?: string | null) {
  if (!v) return '—';
  const map: Record<string, string> = {
    vision: 'Vision',
    toalheiro1: 'Toalheiro 1',
    prateleira: 'Prateleira (canto)',
    nenhum: 'Nenhum',
  };
  const k = String(v).toLowerCase();
  return map[k] ?? titleCase(k);
}
// --- Deep-link for the simulator (locked viewer)
function buildSimUrlFromBudget(b: any) {
  const base =
    process.env.NEXT_PUBLIC_SIM_ORIGIN?.replace(/\/+$/, '') ||
    'https://simulador.mfn.pt';

  const q = new URLSearchParams();

  // Minimum: model
  if (b.modelKey) q.set('model', String(b.modelKey).toLowerCase());

  // Core finish / handle
  if (b.finishKey)       q.set('finish',       String(b.finishKey));
  if (b.handleKey)       q.set('handle',       String(b.handleKey));

  // Glass & serigrafia / acrylic
  if (b.glassTypeKey)    q.set('glass',        String(b.glassTypeKey));
  if (b.acrylicKey)      q.set('acrylic',      String(b.acrylicKey));
  if (b.serigrafiaKey)   q.set('serigrafia',   String(b.serigrafiaKey)); // use 'nenhum' if none
  if (b.serigrafiaColor) q.set('serCor',       String(b.serigrafiaColor)); // 'padrao' | 'acabamento'

  // Complementos (Vision / Toalheiro / Prateleira)
  if (b.complemento)     q.set('complemento',  String(b.complemento));
  if (b.barColor)        q.set('barColor',     String(b.barColor));        // glass|white|black
  if (b.visionSupport)   q.set('visionSupport',String(b.visionSupport));   // finish label/key
  if (b.towelColorMode)  q.set('towel',        String(b.towelColorMode));  // 'padrao'|'acabamento'
  if (b.shelfColorMode)  q.set('shelf',        String(b.shelfColorMode));  // 'padrao'|'acabamento'
  if (b.fixingBarMode)   q.set('fixingBarMode',String(b.fixingBarMode));   // 'padrao'|'acabamento'

  // Locked viewer UI
  q.set('compact', '1');

  return `${base}/?${q.toString()}`;
}
const eur = (c?: number) => (typeof c === 'number' ? (c / 100).toFixed(2) + ' €' : '—');
const mmToCm = (mm?: number) => (typeof mm === 'number' ? `${Math.round(mm / 10)} cm` : '—');

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, color: '#111' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },

  titleBlock: { marginTop: 2, flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  titleText: { fontSize: 18, fontWeight: 700 },
  goldText: { color: brandGold },

  contact: { fontSize: 10, color: '#444', lineHeight: 1.5, textAlign: 'right' },

  section: { marginTop: 10, border: '1pt solid #e5e7eb', borderRadius: 6, overflow: 'hidden' },
  sectionHead: { backgroundColor: '#faf7f1', borderBottom: '1pt solid #e5e7eb', paddingVertical: 8, paddingHorizontal: 10 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: brandGold },
  sectionBody: { padding: 10 },
  simBtn: {
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#FFD200',
    color: '#1a1a1a',
    textDecoration: 'none',
    fontWeight: 700,
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 160, color: '#555' },
  value: { flex: 1, fontWeight: 500 },

  totals: { marginTop: 12, borderTop: '1pt solid #e5e7eb', paddingTop: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { color: '#333' },
  totalValue: { fontWeight: 700 },

  grandTotalBar: { marginTop: 16, padding: 10, borderRadius: 6, backgroundColor: '#fff7e6', border: '1pt solid #f1d59f' },
  grandTotalText: { fontSize: 12, fontWeight: 700, textAlign: 'right' },

  // NEW: bottom-center logo
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerLogo: { height: 56 },
});

export function OrcamentoPDF({ b }: { b: any }) {
  // prefer a fully-qualified origin for @react-pdf image fetching
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';

  const logoUrl = `${base}/brand/goldstar-logo_dark.png`;

  const total = ((b.priceCents ?? 0) + (b.installPriceCents ?? 0)) / 100;

  const deliveryText =
    b.deliveryType === 'entrega_instalacao' || b.deliveryType === 'instalacao'
      ? 'Entrega + Instalação'
      : 'Entrega';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header (no logo here) */}
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.titleText}>Orçamento GOLDSTAR</Text>
          </View>
          <View style={styles.contact}>
            <Text>Avenida das Palmeiras LT115 R/C ESQ</Text>
            <Text>3500-392 Viso-Sul Viseu</Text>
            <Text>+351 232 599 209</Text>
            <Text>geral@mfn.pt</Text>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Cliente</Text></View>
          <View style={styles.sectionBody}>
            <View style={styles.row}><Text style={styles.label}>Nome</Text><Text style={styles.value}>{b.name}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{b.email}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Morada</Text><Text style={styles.value}>{b.address}, {b.postalCode} {b.city}</Text></View>
            {b.nif ? <View style={styles.row}><Text style={styles.label}>NIF</Text><Text style={styles.value}>{b.nif}</Text></View> : null}
          </View>
        </View>

        {/* Produto */}
        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Detalhes do Produto</Text></View>
          <View style={styles.sectionBody}>
            <View style={styles.row}><Text style={styles.label}>Modelo</Text><Text style={styles.value}>{humanModel(b.modelKey)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Puxador</Text><Text style={styles.value}>{humanHandle(b.handleKey)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Acabamento</Text><Text style={styles.value}>{titleCase(String(b.finishKey ?? '—'))}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Vidro / Monocromático</Text><Text style={styles.value}>{titleCase(String(b.glassTypeKey ?? '—'))}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Complemento</Text><Text style={styles.value}>{humanComplemento(b.complemento)}</Text></View>

            {b.complemento === 'vision' && (
              <>
                {b.barColor ? (
                  <View style={styles.row}><Text style={styles.label}>Vision — Barra</Text><Text style={styles.value}>{titleCase(b.barColor)}</Text></View>
                ) : null}
                {b.visionSupport ? (
                  <View style={styles.row}><Text style={styles.label}>Vision — Suporte</Text><Text style={styles.value}>{titleCase(b.visionSupport)}</Text></View>
                ) : null}
              </>
            )}

            {b.willSendLater ? (
              <View style={styles.row}><Text style={styles.label}>Medidas</Text><Text style={styles.value}>A indicar pelo cliente</Text></View>
            ) : (
              <View style={styles.row}>
                <Text style={styles.label}>Medidas</Text>
                <Text style={styles.value}>
                  {mmToCm(b.widthMm)} × {mmToCm(b.heightMm)}{b.depthMm ? ` × ${mmToCm(b.depthMm)}` : ''}
                </Text>
              </View>
            )}

            {b.notes ? <View style={styles.row}><Text style={styles.label}>Notas</Text><Text style={styles.value}>{b.notes}</Text></View> : null}
          </View>
        </View>
        {/* --- View in simulator CTA --- */}
        <View style={{ marginTop: 8, marginBottom: 12, textAlign: 'center' }}>
          <Link
            src={buildSimUrlFromBudget(b)}   // ← was budget
            style={styles.simBtn}
          >
            Ver no simulador
          </Link>
        </View>
        {/* Entrega / Instalação */}
        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Entrega / Instalação</Text></View>
          <View style={styles.sectionBody}>
            <View style={styles.row}><Text style={styles.label}>Tipo</Text><Text style={styles.value}>{deliveryText}</Text></View>
            {b.housingType ? <View style={styles.row}><Text style={styles.label}>Habitação</Text><Text style={styles.value}>{titleCase(b.housingType)}</Text></View> : null}
            {typeof b.floorNumber === 'number' ? <View style={styles.row}><Text style={styles.label}>Andar</Text><Text style={styles.value}>{b.floorNumber}</Text></View> : null}
            {typeof b.hasElevator === 'boolean' ? (
              <View style={styles.row}><Text style={styles.label}>Elevador</Text><Text style={styles.value}>{b.hasElevator ? 'Sim' : 'Não'}</Text></View>
            ) : null}
          </View>
        </View>

        {/* Valores */}
        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Valores</Text></View>
          <View style={styles.sectionBody}>
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Preço</Text>
                <Text style={styles.totalValue}>{eur(b.priceCents)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Custo Instalação</Text>
                <Text style={styles.totalValue}>{eur(b.installPriceCents)}</Text>
              </View>
            </View>
            <View style={styles.grandTotalBar}>
              <Text style={styles.grandTotalText}>Total: {total.toFixed(2)} €</Text>
            </View>
          </View>
        </View>

        {/* Bottom-center logo */}
        <View style={styles.footer}>
          <Image src={logoUrl} style={styles.footerLogo} />
        </View>
      </Page>
    </Document>
  );
}

// app/admin/orcamentos/OrcamentoPDF.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer';

const brandGold = '#FCCC1A';

const titleCase = (s: string) =>
  s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function humanModel(key?: string | null) {
  if (!key) return '-';
  const k = String(key).toLowerCase().replace(/-/g, '_');
  const m = k.match(/_v(\d+)$/);
  const base = titleCase(k.replace(/_v\d+$/, ''));
  return m ? `${base} Variação ${m[1]}` : base;
}
function humanHandle(v?: string | null) {
  if (!v) return '-';
  const m = String(v).match(/^h(\d)$/i);
  return m ? `Puxador ${m[1]}` : titleCase(String(v));
}
function humanComplemento(v?: string | null) {
  if (!v) return '-';
  const map: Record<string, string> = {
    vision: 'Vision',
    toalheiro1: 'Toalheiro 1',
    prateleira: 'Prateleira (canto)',
    nenhum: 'Nenhum',
  };
  const k = String(v).toLowerCase();
  return map[k] ?? titleCase(k);
}
const eur = (c?: number) => (typeof c === 'number' ? (c / 100).toFixed(2) + ' €' : '-');
const mmToCm = (mm?: number) => (typeof mm === 'number' ? `${Math.round(mm / 10)} cm` : '-');

const bonusNiceLabel = (v?: string) =>
  v === 'gelGOLDSTAR' ? 'Gel de Banho GOLDSTAR'
  : v === 'shampooGOLDSTAR' ? 'Shampoo GOLDSTAR'
  : '-';

// Map DB/internal glass keys to the public tokens the simulator expects
function toPublicGlass(raw?: string | null) {
  if (!raw) return '';
  const k = String(raw).toLowerCase().replace(/\s+/g, '');

  // transparent / frosted
  if (k === 'clear' || k === 'transparente' || k === 'transparent') return 'transparente';
  if (k === 'frosted_matte' || k === 'fosco' || k === 'matte' || k === 'opaco') return 'fosco';

  // mono / colored
  if (k === 'mono_gris'   || k === 'mono_black' || k === 'gris'   || k === 'smoke' || k === 'cinza' || k === 'escuro') return 'gris';
  if (k === 'mono_bronze' || k === 'bronze')      return 'bronze';
  if (k === 'mono_green'  || k === 'green'  || k === 'verde')      return 'verde';
  if (k === 'mono_red'    || k === 'red'    || k === 'vermelho')   return 'vermelho';
  if (k === 'mono_visiosun' || k === 'visiosun' || k === 'uv')     return 'visiosun';
  if (k === 'mono_flutes' || k === 'flutes' || k === 'canelado' || k === 'canalete') return 'canelado';

  // fallback: pass through
  return k;
}

// --- Deep-link for the simulator (locked viewer)
function buildSimUrlFromBudget(b: any) {
  const base =
    process.env.NEXT_PUBLIC_SIM_ORIGIN?.replace(/\/+$/, '') ||
    'https://simulador.mfn.pt';

  const q = new URLSearchParams();

  // Model & core look
  if (b.modelKey)       q.set('model', String(b.modelKey));         // e.g. DiplomataGold_V3
  if (b.finishKey)      q.set('finish', String(b.finishKey));       // e.g. Cromado / PretoMate
  if (b.handleKey)      q.set('handle', String(b.handleKey));       // h1..h12 | sem

  // Glass / acrylic
  if (b.glassTypeKey)   q.set('glass', toPublicGlass(b.glassTypeKey));
  // clear|frosted_matte|mono_...
  if (b.acrylicKey && b.acrylicKey !== 'nenhum') {
    q.set('acrylic', String(b.acrylicKey));                         // e.g. poly_clear / poly_white
  }

  // Serigrafia (pattern) + independent ink color
  if (b.serigrafiaKey && b.serigrafiaKey !== 'nenhum') {
    q.set('serigrafia', String(b.serigrafiaKey));                   // SER### | Quadro1.. | Elo1.. | Sereno
    if (b.serigrafiaColor) q.set('serCor', String(b.serigrafiaColor)); // padrao | acabamento
  }

  // Fixing bar (“barra de fixação”) - only two modes
  if (b.fixingBarMode) {
    // padrao | acabamento  (viewer maps → 'default' | 'finish')
    q.set('fixingBarMode', String(b.fixingBarMode));
  }

  // Complementos
  if (b.complemento) {
    const comp = String(b.complemento); // vision | toalheiro1 | prateleira | nenhum
    q.set('complemento', comp);

    if (comp === 'vision') {
      if (b.barColor)      q.set('barColor', String(b.barColor));         // glass|white|black
      if (b.visionSupport) q.set('visionSupport', String(b.visionSupport)); // finish literal
    } else {
      // avoid stale params in URL
      q.delete('barColor');
      q.delete('visionSupport');
    }

    if (comp === 'toalheiro1') {
      if (b.towelColorMode) q.set('towel', String(b.towelColorMode));     // padrao|acabamento
    } else {
      q.delete('towel');
    }

    if (comp === 'prateleira') {
      if (b.shelfColorMode) q.set('shelf', String(b.shelfColorMode));     // padrao|acabamento
      // corner selection (if you capture this in the budget)
      if (b.cornerChoice) q.set('corner', String(b.cornerChoice));        // corner1|corner2|none (supports "canto1/2")
    } else {
      q.delete('shelf');
      q.delete('corner');
    }
  }

  // Optional: compact/locked chrome (the simulator can read this to hide side panels)
  q.set('compact', '1');

  return `${base}/?${q.toString()}`;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, color: '#111' },

  // Header
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logo: { height: 36, marginTop: -2 },
  topRight: { alignItems: 'flex-end' },
  site: { fontSize: 10, color: '#666', textDecoration: 'none' },

  title: { fontSize: 15, fontWeight: 700, marginBottom: 6 },

  section: { marginTop: 10, border: '1pt solid #e5e7eb', borderRadius: 6, overflow: 'hidden' },
  sectionHead: {
    backgroundColor: '#fafafa',
    borderBottom: '1pt solid #e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#111' },
  sectionBody: { padding: 10 },

  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 180, color: '#555' },
  value: { flex: 1, fontWeight: 500 },

  totals: { marginTop: 8, borderTop: '1pt solid #e5e7eb', paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  grand: { marginTop: 8, textAlign: 'right', fontSize: 12, fontWeight: 700 },

  // Button under Valores
  simWrap: { marginTop: 8, textAlign: 'center' },
  simBtn: {
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: brandGold,
    color: '#1a1a1a',
    textDecoration: 'none',
    fontWeight: 700,
  },

  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, fontSize: 9, color: '#777', textAlign: 'center' },
});

export function OrcamentoPDF({ b }: { b: any }) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';

  const logoUrl = `${base}/brand/goldstar-logo_dark.png`;
  const siteUrl = 'https://mfn.pt';

  const total = ((b.priceCents ?? 0) + (b.installPriceCents ?? 0)) / 100;
  const deliveryText =
    b.deliveryType === 'entrega_instalacao' || b.deliveryType === 'instalacao'
      ? 'Entrega + Instalação'
      : 'Entrega';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* header */}
        <View style={styles.headRow}>
          <Image src={logoUrl} style={styles.logo} />
          <View style={styles.topRight}>
            <Link src={siteUrl} style={styles.site}>mfn.pt</Link>
          </View>
        </View>

        <Text style={styles.title}>Resumo do seu Pedido</Text>

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

        {/* Configuração */}
        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Configuração do Resguardo</Text></View>
          <View style={styles.sectionBody}>
            <View style={styles.row}><Text style={styles.label}>Modelo</Text><Text style={styles.value}>{humanModel(b.modelKey)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Puxador</Text><Text style={styles.value}>{humanHandle(b.handleKey)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Acabamento</Text><Text style={styles.value}>{titleCase(String(b.finishKey ?? '-'))}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Vidro / Monocromático</Text><Text style={styles.value}>{titleCase(String(b.glassTypeKey ?? '-'))}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Complemento</Text><Text style={styles.value}>{humanComplemento(b.complemento)}</Text></View>

            {b.complemento === 'vision' && (
              <>
                {b.barColor ? (
                  <View style={styles.row}><Text style={styles.label}>Vision - Barra</Text><Text style={styles.value}>{titleCase(b.barColor)}</Text></View>
                ) : null}
                {b.visionSupport ? (
                  <View style={styles.row}><Text style={styles.label}>Vision - Suporte</Text><Text style={styles.value}>{titleCase(b.visionSupport)}</Text></View>
                ) : null}
              </>
            )}

            <View style={styles.row}>
              <Text style={styles.label}>Medidas</Text>
              <Text style={styles.value}>
                {mmToCm(b.widthMm)} × {mmToCm(b.heightMm)}{b.depthMm ? ` × ${mmToCm(b.depthMm)}` : ''}
              </Text>
            </View>

            {/* Bonus line */}
            <View style={styles.row}>
              <Text style={styles.label}>Bónus escolhido</Text>
              <Text style={styles.value}>{bonusNiceLabel(b.launchBonus)}</Text>
            </View>

            {b.notes ? <View style={styles.row}><Text style={styles.label}>Notas</Text><Text style={styles.value}>{b.notes}</Text></View> : null}
          </View>
        </View>

        {/* Logística */}
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
            <View style={styles.totalRow}><Text>Preço</Text><Text>{eur(b.priceCents)}</Text></View>
            <View style={styles.totalRow}><Text>Instalação</Text><Text>{eur(b.installPriceCents)}</Text></View>
            <Text style={styles.grand}>Total: {total.toFixed(2)} €</Text>
          </View>
        </View>

        {/* CTA: Ver no simulador */}
        <View style={styles.simWrap}>
          <Link src={buildSimUrlFromBudget(b)} style={styles.simBtn}>
            Ver no simulador
          </Link>
        </View>

        <Text style={styles.footer}>
          GOLDSTAR • Avenida das Palmeiras LT115, 3500-392 Viseu • +351 232 599 209 • geral@mfn.pt
        </Text>
      </Page>
    </Document>
  );
}

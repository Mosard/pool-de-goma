// PDF d'une fiche officielle (docs/export-donnees.md, § 4.1) : reconstruit à
// partir de la définition de la VERSION liée au rapport et des calculs figés à
// la soumission. Reproduit la structure de la fiche (cartouche, rubriques,
// grilles, tableaux, synthèse et barème, signatures), pas un fac-similé.

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { CONVERSION_TABLES, MENTIONS, PERCENT_BOUNDS, computeFiche, isVisible, rowsOf, type FicheComputed } from "@/lib/fiches/calculs";
import { commonHeaderFields } from "@/lib/fiches/defs/index";
import type { Block, FicheData, FicheDef, FieldDef, RatedPosteDef, SignatureDef, TableDef } from "@/lib/fiches/types";
import { conseilsKey, freeLabelKey, obsKey } from "@/lib/fiches/types";

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica", color: "#111" },
  cartouche: { flexDirection: "row", borderWidth: 1, borderColor: "#111" },
  ministere: { width: "26%", padding: 6, borderRightWidth: 1, borderColor: "#111", justifyContent: "center" },
  center: { textAlign: "center" },
  bold: { fontFamily: "Helvetica-Bold" },
  postes: { width: "50%", borderRightWidth: 1, borderColor: "#111" },
  poste: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#999", paddingVertical: 2, paddingHorizontal: 4 },
  ventilation: { width: "16%", borderRightWidth: 1, borderColor: "#111", padding: 3 },
  code: { width: "8%", alignItems: "center", justifyContent: "center", padding: 3 },
  codeText: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginVertical: 8, borderWidth: 1, borderColor: "#111", paddingVertical: 4 },
  section: { marginTop: 8 },
  sectionTitle: { fontFamily: "Helvetica-Bold", backgroundColor: "#e5e7eb", paddingVertical: 3, paddingHorizontal: 4, borderWidth: 0.5, borderColor: "#111" },
  field: { flexDirection: "row", paddingVertical: 2 },
  label: { width: "40%", color: "#333" },
  value: { width: "60%", fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 0.5, borderColor: "#111", marginTop: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#999" },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#f3f4f6" },
  td: { padding: 2, borderRightWidth: 0.5, borderColor: "#999" },
  note: { color: "#444", marginVertical: 2 },
  sigRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  sig: { width: "48%", borderWidth: 0.5, borderColor: "#111", padding: 4, minHeight: 70 },
  sigImg: { height: 40, objectFit: "contain", marginTop: 2 },
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, fontSize: 7, color: "#666", flexDirection: "row", justifyContent: "space-between" },
});

const box = (checked: boolean) => (checked ? "[X]" : "[  ]");
const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]).join(", ") : "");
const noteLabel = (v: string) => (v === "SO" ? "S.O." : v);

function FieldLine({ f, data }: { f: FieldDef; data: FicheData }) {
  if (!isVisible(f.showIf, data.values)) return null;
  const raw = data.values[f.id];
  let value = str(raw);
  if (f.type === "checks" && f.options) value = f.options.map((o) => `${box(Array.isArray(raw) && (raw as string[]).includes(o))} ${o}`).join("   ");
  if (f.type === "note") value = noteLabel(value);
  return (
    <View style={s.field} wrap={false}>
      <Text style={s.label}>{f.label}</Text>
      <Text style={s.value}>{value || "—"}</Text>
    </View>
  );
}

function Rated({ p, data, computed }: { p: RatedPosteDef; data: FicheData; computed: FicheComputed }) {
  const res = computed.postes[p.id];
  const w = { num: "9%", label: "37%", obs: "44%", note: "10%" };
  return (
    <View style={s.table}>
      <View style={[s.tr, s.th]}>
        <Text style={[s.td, { width: w.num }]}>N°</Text>
        <Text style={[s.td, { width: w.label }]}>{p.label}</Text>
        <Text style={[s.td, { width: w.obs }]}>Observations</Text>
        <Text style={[s.td, { width: w.note, textAlign: "center" }]}>{p.scale === "M-E" ? "M à E" : "0 - 4"}</Text>
      </View>
      {p.items.map((i) => (
        <View key={i.id} style={s.tr} wrap={false}>
          <Text style={[s.td, { width: w.num }]}>{i.num ?? i.id}</Text>
          <Text style={[s.td, { width: w.label }]}>{p.freeItems?.includes(i.id) ? str(data.values[freeLabelKey(i.id)]) : i.label}</Text>
          <Text style={[s.td, { width: w.obs }]}>{str(data.values[obsKey(i.id)])}</Text>
          <Text style={[s.td, { width: w.note, textAlign: "center" }, s.bold]}>{noteLabel(str(data.values[i.id]))}</Text>
        </View>
      ))}
      {p.conversion && (
        <View style={s.tr} wrap={false}>
          <Text style={[s.td, { width: "90%", textAlign: "right" }]}>
            Total : {res?.points ?? 0} pts / {res?.filled ?? 0} rubrique(s){res?.percent != null ? ` — Z = ${res.percent} %` : ""} — Conversion
          </Text>
          <Text style={[s.td, { width: "10%", textAlign: "center" }, s.bold]}>{res?.note ?? "—"}</Text>
        </View>
      )}
      {p.conseils !== false && (
        <View style={{ padding: 3 }} wrap={false}>
          <Text style={s.bold}>{p.conseilsLabel ?? "Conseils"} :</Text>
          <Text>{str(data.values[conseilsKey(p.id)]) || "—"}</Text>
        </View>
      )}
    </View>
  );
}

function Table({ t, data, computed }: { t: TableDef; data: FicheData; computed: FicheComputed }) {
  const rows = rowsOf(t, data.values);
  const res = computed.tables[t.id];
  const cols = t.columns.filter((c) => c.type !== "signature");
  const width = `${Math.floor((t.fixedRows ? 82 : 100) / Math.max(cols.length, 1))}%`;
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={s.bold}>{t.label}</Text>
      <View style={s.table}>
        <View style={[s.tr, s.th]}>
          {t.fixedRows && <Text style={[s.td, { width: "18%" }]}> </Text>}
          {cols.map((c) => (
            <Text key={c.id} style={[s.td, { width }]}>
              {c.label}
            </Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r._id} style={s.tr} wrap={false}>
            {t.fixedRows && <Text style={[s.td, { width: "18%" }, s.bold]}>{t.fixedRows.find((f) => f.id === r._id)?.label}</Text>}
            {cols.map((c) => (
              <Text key={c.id} style={[s.td, { width }]}>
                {c.percentOf || c.sumOf ? String(res?.percents[r._id]?.[c.id] ?? "") : (r[c.id] ?? "")}
              </Text>
            ))}
          </View>
        ))}
        {(t.sumColumns?.length ?? 0) > 0 && (
          <View style={[s.tr, s.th]} wrap={false}>
            {t.fixedRows && <Text style={[s.td, { width: "18%" }]}>TOTAL</Text>}
            {cols.map((c) => (
              <Text key={c.id} style={[s.td, { width }]}>
                {t.sumColumns?.includes(c.id) ? String(res?.totals[c.id] ?? 0) : ""}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function Signature({ b, data }: { b: SignatureDef; data: FicheData }) {
  const sig = data.signatures[b.id];
  return (
    <View style={s.sig} wrap={false}>
      <Text style={s.bold}>{b.label}</Text>
      {b.mention && <Text style={s.note}>{b.mention}</Text>}
      {sig ? (
        <View>
          <Text>
            {sig.name}
            {sig.place ? ` — Fait à ${sig.place}` : ""}
            {sig.date ? `, le ${new Date(sig.date + "T00:00:00").toLocaleDateString("fr-FR")}` : ""}
          </Text>
          {sig.refused ? (
            <View>
              <Text style={s.bold}>Refus de signer</Text>
              {(sig.witnesses ?? []).map((w, i) => (
                <View key={i}>
                  <Text>
                    Témoin {i + 1} : {w.name}
                  </Text>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  {w.image ? <Image style={s.sigImg} src={w.image} /> : null}
                </View>
              ))}
            </View>
          ) : sig.image ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={s.sigImg} src={sig.image} />
          ) : null}
        </View>
      ) : (
        <Text style={s.note}>Non signé.</Text>
      )}
    </View>
  );
}

function BlockView({ b, data, computed }: { b: Block; data: FicheData; computed: FicheComputed }) {
  if ("showIf" in b && !isVisible(b.showIf, data.values)) return null;
  switch (b.kind) {
    case "field":
      return <FieldLine f={b} data={data} />;
    case "rated":
      return <Rated p={b} data={data} computed={computed} />;
    case "table":
      return <Table t={b} data={data} computed={computed} />;
    case "signature":
      return <Signature b={b} data={data} />;
    case "computed":
      return (
        <View style={s.field}>
          <Text style={s.label}>{b.label}</Text>
          <Text style={s.value}>{computed.derived[b.id] ? new Date(computed.derived[b.id]! + "T00:00:00").toLocaleDateString("fr-FR") : "—"}</Text>
        </View>
      );
    case "text":
      return <Text style={b.style === "legal" ? s.note : { marginVertical: 2 }}>{b.text}</Text>;
  }
}

export type FichePdfInput = {
  def: FicheDef;
  data: FicheData;
  /** Calculs figés à la soumission (Form.computed) ; recalculés seulement s'ils manquent. */
  computed: FicheComputed | null;
  number: string | null;
  statusLabel: string;
};

export function FichePdf({ def, data, computed: frozen, number, statusLabel }: FichePdfInput) {
  const computed = frozen ?? computeFiche(def, data.values);
  const header = commonHeaderFields(def);
  const v = (id: string) => str(data.values[id]);
  const postes: [string, string][] = [
    [header[0].label, v("entete.inspecteur")],
    [header[2].label, v("entete.niveauDiscipline")],
    [header[3].label, v("entete.posteAttache")],
    ["04. B.P.", `${v("entete.bp")}${v("entete.bpLieu") ? ` à ${v("entete.bpLieu")}` : ""}`],
    ["05. Téléphone / E-mail", [v("entete.telephone"), v("entete.email")].filter(Boolean).join(" — ")],
    ...def.header.filter((f) => isVisible(f.showIf, data.values)).map((f): [string, string] => [f.label, v(f.id)]),
    ["Année scolaire", v("entete.anneeScolaire")],
    [def.numberLabel ?? "Rapport n°", number ?? "—"],
  ];
  const dest = Array.isArray(data.values["entete.destinataires"]) ? (data.values["entete.destinataires"] as string[]) : [];
  const sections = def.sections.filter((sec) => isVisible(sec.showIf, data.values));
  const syn = def.synthese ? computed.synthese : null;

  return (
    <Document title={`${def.code} — version ${def.version}${number ? ` — ${number}` : ""}`} subject={def.title} author="IPP Nord-Kivu 1" creator="IPP Nord-Kivu 1">
      <Page size="A4" style={s.page}>
        <View style={s.cartouche}>
          <View style={s.ministere}>
            <Text style={[s.center, { fontSize: 7 }]}>REPUBLIQUE DEMOCRATIQUE DU CONGO</Text>
            <Text style={[s.center, { fontSize: 7 }]}>Ministère de l&apos;Education Nationale et Nouvelle Citoyenneté</Text>
            <Text style={[s.center, s.bold, { marginTop: 8 }]}>INSPECTION GENERALE</Text>
            <Text style={[s.center, { fontSize: 7, marginTop: 2 }]}>IPP Nord-Kivu 1</Text>
          </View>
          <View style={s.postes}>
            {postes.map(([l, val], i) => (
              <View key={i} style={s.poste}>
                <Text style={{ width: "45%" }}>{l}</Text>
                <Text style={[{ width: "55%" }, s.bold]}>{val || ""}</Text>
              </View>
            ))}
            <View style={s.poste}>
              <Text style={{ width: "45%" }}>Sexe</Text>
              <Text style={{ width: "55%" }}>
                {box(v("entete.inspecteurSexe") === "M")} M   {box(v("entete.inspecteurSexe") === "F")} F
              </Text>
            </View>
          </View>
          <View style={s.ventilation}>
            {def.destinataires.map((d) => (
              <Text key={d} style={{ fontSize: 7 }}>
                {box(dest.includes(d))} {d}
              </Text>
            ))}
          </View>
          <View style={s.code}>
            <Text style={s.codeText}>{def.code}</Text>
            {def.levels
              ? ["M", "P", "S"].map((n) => (
                  <Text key={n} style={{ fontSize: 8, marginTop: 2 }}>
                    {n} {box(v("entete.niveau") === n)}
                  </Text>
                ))
              : null}
          </View>
        </View>

        <Text style={s.title}>{def.title}</Text>

        {sections.map((sec) => (
          <View key={sec.id} style={s.section}>
            <Text style={s.sectionTitle} minPresenceAhead={40}>
              {sec.title}
            </Text>
            {sec.blocks.some((b) => b.kind === "signature") ? (
              <View style={s.sigRow}>
                {sec.blocks.map((b, i) => (b.kind === "signature" ? <Signature key={i} b={b} data={data} /> : <BlockView key={i} b={b} data={data} computed={computed} />))}
              </View>
            ) : (
              sec.blocks.map((b, i) => <BlockView key={i} b={b} data={data} computed={computed} />)
            )}
          </View>
        ))}

        {syn && def.synthese ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>{def.synthese.label}</Text>
            <View style={s.table}>
              {syn.parts.map((p) => (
                <View key={p.id} style={s.tr}>
                  <Text style={[s.td, { width: "85%" }]}>{p.label}</Text>
                  <Text style={[s.td, { width: "15%", textAlign: "center" }, s.bold]}>{p.note ?? "—"}</Text>
                </View>
              ))}
              <View style={[s.tr, s.th]}>
                <Text style={[s.td, { width: "85%" }]}>Conversion / Total</Text>
                <Text style={[s.td, { width: "15%", textAlign: "center" }]}>
                  {syn.note ?? "—"} / {syn.total ?? "—"}
                </Text>
              </View>
            </View>
            <Text style={[s.title, { fontSize: 11 }]}>
              {def.synthese.finalLabel} : {syn.mention ?? "non calculable"}
            </Text>
            <ConversionTable def={def} />
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>
            Fiche {def.code} — version {def.version} — {statusLabel}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${number ?? ""}   ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function ConversionTable({ def }: { def: FicheDef }) {
  if (!def.synthese) return null;
  const rows = CONVERSION_TABLES[def.synthese.table];
  const cell = [s.td, { width: "16.6%", textAlign: "center" as const }];
  return (
    <View style={s.table}>
      <View style={[s.tr, s.th]}>
        <Text style={cell}>NOTE</Text>
        {[4, 3, 2, 1, 0].map((n) => (
          <Text key={n} style={cell}>
            {n}
          </Text>
        ))}
      </View>
      <View style={s.tr}>
        <Text style={cell}>%</Text>
        {[...PERCENT_BOUNDS, 0].map((b, i) => (
          <Text key={i} style={cell}>
            {i === 0 ? 100 : PERCENT_BOUNDS[i - 1] - 1} - {b}
          </Text>
        ))}
      </View>
      {Object.entries(rows).map(([rr, bounds]) => (
        <View key={rr} style={s.tr}>
          <Text style={cell}>{rr}</Text>
          {[...bounds, 0].map((b, i) => (
            <Text key={i} style={cell}>
              {i === 0 ? Number(rr) * 4 : bounds[i - 1] - 1} - {b}
            </Text>
          ))}
        </View>
      ))}
      <View style={s.tr}>
        <Text style={cell}>MENTION</Text>
        {[...MENTIONS].reverse().map((m) => (
          <Text key={m} style={cell}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Rapport de l'ancien circuit ou fiche simulée : présentation simple (décision Q4). */
export function SimplePdf(p: { title: string; subtitle: string; summary: string | null; recommendations: string | null; fields: { label: string; value: string }[]; statusLabel: string }) {
  return (
    <Document title={p.title} author="IPP Nord-Kivu 1">
      <Page size="A4" style={s.page}>
        <Text style={[s.center, { fontSize: 8 }]}>REPUBLIQUE DEMOCRATIQUE DU CONGO — INSPECTION GENERALE — IPP Nord-Kivu 1</Text>
        <Text style={s.title}>{p.title}</Text>
        <Text style={s.note}>{p.subtitle}</Text>
        {p.summary ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Résumé</Text>
            <Text>{p.summary}</Text>
          </View>
        ) : null}
        {p.recommendations ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recommandations</Text>
            <Text>{p.recommendations}</Text>
          </View>
        ) : null}
        {p.fields.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Fiche</Text>
            {p.fields.map((f, i) => (
              <View key={i} style={s.field}>
                <Text style={s.label}>{f.label}</Text>
                <Text style={s.value}>{f.value || "—"}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={s.footer} fixed>
          <Text>{p.statusLabel}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderPdf(doc: React.ReactElement): Promise<Buffer> {
  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}

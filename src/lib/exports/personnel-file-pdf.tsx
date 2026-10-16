// PDF de la fiche individuelle (formulaire IGAP « Fiche de renseignement de
// l'agent de l'administration », 9 pages). Reprend l'ordre, les rubriques et
// la terminologie du formulaire (N°, libellé, informations, OBS.), en A4.
// Un champ non renseigné reste VIDE (à compléter à la main au besoin) ; aucune
// signature n'est produite : la déclaration et les cadres de signature restent
// à remplir sur la version imprimée.

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { CHILD_FIELDS, CHILD_RELATIONS, DIPLOMA_FIELDS, PERSONNEL_FILE_SECTIONS, PROMOTION_FIELDS, STUDY_LEVELS, type FieldDef } from "@/lib/personnel-file/defs";
import type { FileView } from "@/lib/personnel-file/server";
import { formatValue, plainRow, type Cell } from "@/components/personnel-file/format";

const BORDER = "#555";
const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 30, fontSize: 8.5, fontFamily: "Helvetica", color: "#111" },
  bold: { fontFamily: "Helvetica-Bold" },
  rdc: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center" },
  ministry: { fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 2 },
  igap: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 3 },
  title: { marginTop: 6, borderWidth: 1, borderColor: BORDER, backgroundColor: "#f1f1f1", padding: 5, fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "center" },
  agent: { marginTop: 6, marginBottom: 6, flexDirection: "row", justifyContent: "space-between", fontSize: 8 },
  table: { borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: BORDER },
  row: { flexDirection: "row", borderBottomWidth: 0.75, borderColor: BORDER },
  n: { width: "7%", padding: 3, borderRightWidth: 0.75, borderColor: BORDER, textAlign: "center" },
  label: { width: "40%", padding: 3, borderRightWidth: 0.75, borderColor: BORDER },
  value: { width: "40%", padding: 3, borderRightWidth: 0.75, borderColor: BORDER, fontFamily: "Helvetica-Bold" },
  obs: { width: "13%", padding: 3, borderRightWidth: 0.75, borderColor: BORDER, fontSize: 7, color: "#333" },
  wide: { width: "93%", padding: 3, borderRightWidth: 0.75, borderColor: BORDER },
  head: { backgroundColor: "#e4e4e4", fontFamily: "Helvetica-Bold" },
  section: { backgroundColor: "#d6d6d6", fontFamily: "Helvetica-Bold" },
  group: { backgroundColor: "#efefef", fontFamily: "Helvetica-Bold" },
  sub: { backgroundColor: "#f7f7f7", fontFamily: "Helvetica-Bold" },
  oath: { marginTop: 10, borderWidth: 0.75, borderColor: BORDER },
  oathTitle: { padding: 5, fontFamily: "Helvetica-Bold", textAlign: "center", borderBottomWidth: 0.75, borderColor: BORDER },
  oathRow: { flexDirection: "row" },
  oathCell: { width: "50%", padding: 8, minHeight: 34, borderRightWidth: 0.75, borderColor: BORDER },
  sign: { width: "50%", padding: 8, minHeight: 92, borderRightWidth: 0.75, borderTopWidth: 0.75, borderColor: BORDER, textAlign: "center" },
  footer: { position: "absolute", bottom: 16, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#555" },
  // Tableau des enfants (page paysage, comme la page 9 du formulaire).
  cth: { padding: 3, borderRightWidth: 0.75, borderColor: BORDER, fontFamily: "Helvetica-Bold", backgroundColor: "#e4e4e4", fontSize: 7.5 },
  ctd: { padding: 3, borderRightWidth: 0.75, borderColor: BORDER, fontSize: 7.5 },
  legend: { marginTop: 8, borderWidth: 0.75, borderColor: BORDER, padding: 5, width: 180, fontSize: 7.5 },
});

const val = (f: FieldDef, v: Cell) => formatValue(f, v) ?? "";
const childWidth = (key: string) => (key === "relation" ? "8%" : key === "sex" ? "5%" : "11.85%");

function FieldRows({ fields, values, numbering = "number" }: { fields: readonly FieldDef[]; values: Record<string, Cell>; numbering?: "number" | "letter" }) {
  return (
    <>
      {fields.map((f, i) => (
        <View key={f.key} style={s.row} wrap={false}>
          <Text style={s.n}>{numbering === "letter" ? `${String.fromCharCode(97 + i)}.` : `${i + 1}.`}</Text>
          <Text style={s.label}>{f.label}</Text>
          <Text style={s.value}>{val(f, values[f.key])}</Text>
          <Text style={s.obs} />
        </View>
      ))}
    </>
  );
}

function HeaderRow({ code, title, style, obs }: { code: string; title: string; style: Style; obs?: string | null }) {
  return (
    <View style={[s.row, style]} wrap={false} minPresenceAhead={40}>
      <Text style={s.n}>{code}</Text>
      <Text style={{ width: "80%", padding: 3, borderRightWidth: 0.75, borderColor: BORDER }}>{title.toUpperCase()}</Text>
      <Text style={s.obs}>{obs ?? ""}</Text>
    </View>
  );
}

function Note({ children }: { children: string }) {
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.n} />
      <Text style={[s.wide, { color: "#555" }]}>{children}</Text>
    </View>
  );
}

export type PersonnelFilePdfInput = { view: FileView; generatedAt: Date };

export function PersonnelFilePdf({ view, generatedAt }: PersonnelFilePdfInput) {
  const generated = generatedAt.toLocaleString("fr-FR", { timeZone: "Africa/Lubumbashi", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const promos = view.promotions.map((p) => plainRow(p as unknown as Record<string, unknown>, PROMOTION_FIELDS.map((f) => f.key)));
  const diplomas = view.diplomas.map((d) => plainRow(d as unknown as Record<string, unknown>, DIPLOMA_FIELDS.map((f) => f.key)));
  const children = view.children.map((c) => plainRow(c as unknown as Record<string, unknown>, CHILD_FIELDS.map((f) => f.key)));
  const footer = (
    <View style={s.footer} fixed>
      <Text>Fiche de renseignement — {view.user.name} — générée le {generated} (heure de Goma)</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} sur ${totalPages}`} />
    </View>
  );

  return (
    <Document title={`Fiche de renseignement — ${view.user.name}`} author="IPP Nord-Kivu 1" creator="Plateforme IPP Nord-Kivu 1">
      <Page size="A4" style={s.page}>
        <Text style={s.rdc}>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</Text>
        <Text style={s.ministry}>MINISTÈRE DE LA FONCTION PUBLIQUE, MODERNISATION DE L&apos;ADMINISTRATION ET INNOVATION DU SERVICE PUBLIC</Text>
        <Text style={s.igap}>Inspection Générale de l&apos;Administration Publique (IGAP)</Text>
        <Text style={s.title}>
          FICHE DE RENSEIGNEMENT DE L&apos;AGENT DE L&apos;ADMINISTRATION DE L&apos;INSPECTION GÉNÉRALE DE L&apos;ÉDUCATION NATIONALE ET NOUVELLE CITOYENNETÉ
        </Text>
        <View style={s.agent}>
          <Text>
            Agent : <Text style={s.bold}>{view.user.name}</Text>
          </Text>
          <Text>Édition du {generated}</Text>
        </View>

        <View style={s.table}>
          <View style={[s.row, s.head]} fixed>
            <Text style={s.n}>N°</Text>
            <Text style={s.label}>LIBELLÉ – CHAMPS</Text>
            <Text style={s.value}>INFORMATIONS</Text>
            <Text style={s.obs}>OBS.</Text>
          </View>

          {PERSONNEL_FILE_SECTIONS.map((section) => (
            <View key={section.key}>
              <HeaderRow code={section.roman} title={section.title} style={s.section} />
              {section.groups.map((g) => {
                const obs = view.observations[g.key] ?? null;
                if (g.kind === "fields") {
                  return (
                    <View key={g.key}>
                      <HeaderRow code={g.code} title={g.title} style={s.group} obs={obs} />
                      <FieldRows fields={g.fields} values={(view.values[g.key] ?? {}) as Record<string, Cell>} />
                    </View>
                  );
                }
                if (g.kind === "promotions") {
                  return (
                    <View key={g.key}>
                      <HeaderRow code={g.code} title={g.title} style={s.group} obs={obs} />
                      {promos.length === 0 ? (
                        <Note>Aucune promotion renseignée.</Note>
                      ) : (
                        promos.map((p, i) => (
                          <View key={i}>
                            <HeaderRow code={`${i + 1}.`} title={`Grade promotion ${i + 1}`} style={s.sub} />
                            <FieldRows fields={PROMOTION_FIELDS} values={p} numbering="letter" />
                          </View>
                        ))
                      )}
                    </View>
                  );
                }
                if (g.kind === "diplomas") {
                  return (
                    <View key={g.key}>
                      {STUDY_LEVELS.map((level, li) => {
                        const items = diplomas.filter((d) => d.level === level.value);
                        const fields = DIPLOMA_FIELDS.filter((f) => f.key !== "level" && (level.value === "D6" || f.key !== "institutionCommune"));
                        return (
                          <View key={level.value}>
                            <HeaderRow code={String.fromCharCode(65 + li)} title={level.label} style={s.group} obs={li === 0 ? obs : null} />
                            {(items.length ? items : [{} as Record<string, Cell>]).map((d, i) => (
                              <View key={i}>
                                {items.length > 1 && <HeaderRow code="" title={`Titre ${i + 1}`} style={s.sub} />}
                                <FieldRows fields={fields} values={d} />
                              </View>
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  );
                }
                return (
                  <View key={g.key}>
                    <HeaderRow code={g.code} title={g.title} style={s.group} obs={obs} />
                    <Note>
                      {children.length
                        ? `${children.length} enfant(s) — voir le tableau « III.E Fiche d'informations sur les enfants de l'agent ».`
                        : "Aucun enfant renseigné."}
                    </Note>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={s.oath} wrap={false}>
          <Text style={s.oathTitle}>Je jure en mon honneur que les renseignements fournis ci-dessus sont sincères et exacts</Text>
          <View style={s.oathRow}>
            <Text style={s.oathCell}>Fait à ……………………………… le ……………………………</Text>
            <Text style={s.oathCell}>Fait à ……………………………… le ……………………………</Text>
          </View>
          <View style={s.oathRow}>
            <View style={s.sign}>
              <Text style={[s.bold, { textDecoration: "underline" }]}>Pour réception</Text>
              <Text style={{ marginTop: 8 }}>(Nom et Signature de l&apos;Inspecteur-Auditeur)</Text>
              <Text style={{ marginTop: 26 }}>……………………………………………………………</Text>
            </View>
            <View style={s.sign}>
              <Text style={{ marginTop: 18 }}>(Nom et Signature de l&apos;Agent)</Text>
              <Text style={{ marginTop: 26 }}>……………………………………………………………</Text>
            </View>
          </View>
        </View>
        {footer}
      </Page>

      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={[s.title, { marginTop: 0 }]}>III.E. FICHE D&apos;INFORMATIONS SUR LES ENFANTS DE L&apos;AGENT</Text>
        <View style={[s.table, { marginTop: 6 }]}>
          <View style={s.row} fixed>
            <Text style={[s.cth, { width: "4%" }]}>N°</Text>
            {CHILD_FIELDS.map((f) => (
              <Text key={f.key} style={[s.cth, { width: childWidth(f.key) }]}>
                {f.key === "relation" ? "OBS (EBio, EAd, EST)" : f.label}
              </Text>
            ))}
          </View>
          {children.map((c, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={[s.ctd, { width: "4%" }]}>{i + 1}.</Text>
              {CHILD_FIELDS.map((f) => (
                <Text key={f.key} style={[s.ctd, { width: childWidth(f.key) }]}>
                  {f.key === "relation" ? (CHILD_RELATIONS.find((r) => r.value === c.relation)?.short ?? "") : f.key === "sex" ? String(c.sex ?? "") : val(f, c[f.key])}
                </Text>
              ))}
            </View>
          ))}
          {children.length === 0 && (
            <View style={s.row}>
              <Text style={[s.ctd, { width: "100%", color: "#555" }]}>Aucun enfant renseigné.</Text>
            </View>
          )}
        </View>
        <View style={s.legend} wrap={false}>
          <Text style={[s.bold, { textDecoration: "underline" }]}>LÉGENDE</Text>
          <Text>EBio : Enfant biologique</Text>
          <Text>EAd : Enfant adoptif</Text>
          <Text>EST : Enfant sous tutelle</Text>
        </View>
        {footer}
      </Page>
    </Document>
  );
}

export async function buildPersonnelFilePdf(view: FileView): Promise<{ body: Buffer; filename: string }> {
  const body = await renderToBuffer((<PersonnelFilePdf view={view} generatedAt={new Date()} />) as Parameters<typeof renderToBuffer>[0]);
  const slug =
    view.user.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "agent";
  return { body, filename: `fiche-renseignement-${slug}.pdf` };
}

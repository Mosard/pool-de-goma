// Fiche individuelle du personnel : définition UNIQUE des rubriques et des
// champs du formulaire IGAP « Fiche de renseignement de l'agent de
// l'administration » (pages 1 à 9). Sert au formulaire, à la consultation, à
// la complétude et au PDF : un champ ajouté ici apparaît partout.
//
// Trois sortes de rubriques :
//  - « fields »  : valeurs uniques, enregistrées dans PersonnelFileSection.data
//                  (sauf les champs `userColumn`, lus et écrits dans User) ;
//  - « promotions », « diplomas », « children » : entrées répétables, chacune
//                  dans sa table (PersonnelPromotion, PersonnelDiploma, PersonnelChild).
//
// Aucune valeur n'est utilisée par les droits, fonctions, POOL ou cellules.

export type FieldKind = "text" | "textarea" | "date" | "year" | "number" | "email" | "tel" | "yesno" | "choice" | "list";

/** Colonnes du compte reprises par la fiche (aucune copie : une seule valeur). */
export type UserColumn = "postnom" | "prenom" | "sex" | "dateNaissance" | "phone" | "matricule" | "nombreEnfants";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  /** Choix proposés (kind « choice ») : valeur enregistrée → libellé. */
  options?: readonly { value: string; label: string }[];
  /** Champ porté par le compte : lu et écrit dans User, jamais dans la fiche. */
  userColumn?: UserColumn;
  /** Valeur proposée tant que le champ est vide (jamais enregistrée d'office). */
  prefill?: "accountEmail";
  maxLength?: number;
};

export type FieldsGroup = { kind: "fields"; key: string; code: string; title: string; hint?: string; fields: readonly FieldDef[] };
export type RepeatGroup = { kind: "promotions" | "diplomas" | "children"; key: string; code: string; title: string; hint?: string };
export type GroupDef = FieldsGroup | RepeatGroup;

export type SectionDef = { key: string; roman: string; title: string; sensitive?: boolean; groups: readonly GroupDef[] };

const t = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, kind: "text", ...extra });
const d = (key: string, label: string): FieldDef => ({ key, label, kind: "date" });
const yn = (key: string, label: string): FieldDef => ({ key, label, kind: "yesno" });

export const SEX_OPTIONS = [
  { value: "M", label: "Masculin" },
  { value: "F", label: "Féminin" },
] as const;

/** Champs d'un acte administratif (engagement, grades, transfert…), dans l'ordre du formulaire. */
function actFields(): FieldDef[] {
  return [
    t("actNature", "Nature acte (Décision, Arrêté, Décret, Ord…)"),
    t("actReference", "Référence acte"),
    d("actSignedAt", "Date de signature de l'acte"),
    t("actSignatory", "Signataire de l'acte"),
    t("notifReference", "Référence notification acte"),
    d("notifDate", "Date de notification d'acte"),
    t("notifSignatory", "Signataire de la notification d'acte"),
  ];
}

function personFields(): FieldDef[] {
  return [
    t("nom", "Nom"),
    t("postnom", "Post-nom"),
    t("prenom", "Prénom"),
    d("dateNaissance", "Date de naissance"),
    t("lieuNaissance", "Lieu de naissance (Ville et Pays)"),
    t("nationalite", "Nationalité"),
    t("profession", "Profession"),
  ];
}

function originFields(withDistrict: boolean): FieldDef[] {
  return [
    t("province", "Province"),
    ...(withDistrict ? [t("district", "District")] : []),
    t("territoire", "Territoire"),
    t("secteur", "Secteur"),
    t("groupement", "Groupement"),
    t("village", "Village"),
  ];
}

export const PERSONNEL_FILE_SECTIONS: readonly SectionDef[] = [
  {
    key: "personnel",
    roman: "I",
    title: "Informations personnelles de l'agent",
    groups: [
      {
        kind: "fields",
        key: "identite",
        code: "A",
        title: "Identité de l'agent",
        fields: [
          { key: "sex", label: "Genre (Masculin / Féminin)", kind: "choice", options: SEX_OPTIONS, userColumn: "sex" },
          t("nom", "Nom"),
          t("postnom", "Post-nom", { userColumn: "postnom" }),
          t("prenom", "Prénom", { userColumn: "prenom" }),
          { key: "dateNaissance", label: "Date de naissance", kind: "date", userColumn: "dateNaissance" },
          t("lieuNaissance", "Lieu de naissance (Ville et Pays)"),
          t("nationalite", "Nationalité"),
        ],
      },
      { kind: "fields", key: "origine", code: "B", title: "Origine de l'agent", fields: originFields(false) },
      { kind: "fields", key: "pere", code: "C.1", title: "Information du père de l'agent", fields: personFields() },
      { kind: "fields", key: "mere", code: "C.2", title: "Information de la mère de l'agent", fields: personFields() },
      {
        kind: "fields",
        key: "piece",
        code: "D",
        title: "Pièce d'identité de l'agent",
        fields: [
          t("nature", "Nature pièce d'identité"),
          t("numero", "Numéro pièce d'identité"),
          d("delivreeLe", "Date de délivrance pièce d'identité"),
          t("lieuDelivrance", "Lieu de délivrance pièce d'identité"),
          d("expireLe", "Date d'expiration pièce d'identité"),
        ],
      },
      {
        kind: "fields",
        key: "adresse",
        code: "E",
        title: "Adresse physique",
        fields: [
          t("numero", "Numéro"),
          t("avenue", "Avenue / Rue"),
          t("quartier", "Quartier / Groupement"),
          t("commune", "Commune"),
          t("ville", "Ville"),
          t("province", "Province"),
          t("pays", "Pays"),
          t("continent", "Continent"),
        ],
      },
      {
        kind: "fields",
        key: "contacts",
        code: "F",
        title: "Contacts personnels",
        hint: "Le téléphone (1) est celui du compte. L'adresse électronique (1) reprend celle du compte tant qu'elle n'est pas modifiée ici ; l'identifiant de connexion ne change jamais.",
        fields: [
          { key: "phone", label: "Numéro de téléphone (1)", kind: "tel", userColumn: "phone" },
          { key: "telephone2", label: "Numéro de téléphone (2)", kind: "tel" },
          { key: "email1", label: "Adresse électronique (E-mail) (1)", kind: "email", prefill: "accountEmail" },
          { key: "email2", label: "Adresse électronique (E-mail) (2)", kind: "email" },
        ],
      },
      {
        kind: "fields",
        key: "urgence",
        code: "G",
        title: "Personne à contacter (en cas d'urgence)",
        fields: [
          t("nom", "Nom"),
          t("postnom", "Post-nom"),
          t("prenom", "Prénom"),
          t("lien", "Lien de parenté"),
          t("adresse", "Adresse physique"),
          { key: "telephone", label: "Numéro de téléphone", kind: "tel" },
          { key: "email", label: "Adresse électronique (E-mail)", kind: "email" },
        ],
      },
    ],
  },
  {
    key: "administratif",
    roman: "II",
    title: "Situation administrative",
    groups: [
      {
        kind: "fields",
        key: "mention",
        code: "1-2",
        title: "Mention utile et déclaration",
        fields: [
          {
            key: "mention",
            label: "Mention utile",
            kind: "choice",
            options: [
              { value: "MATRICULE", label: "Matriculé" },
              { value: "DINACOPE", label: "ID DINACOPE" },
              { value: "NOUVELLE_UNITE", label: "Nouvelle unité" },
            ],
          },
          yn("declare", "Déclaré (OUI / NON)"),
        ],
      },
      {
        kind: "fields",
        key: "engagement",
        code: "A",
        title: "Engagement",
        hint: "Le numéro (matricule, ID DINACOPE) est celui du compte : une seule valeur, chaque changement est journalisé.",
        fields: [t("matricule", "Numéro (Matricule, ID DINACOPE)", { userColumn: "matricule" }), t("grade", "Grade d'engagement"), ...actFields()],
      },
      {
        kind: "fields",
        key: "admission",
        code: "B",
        title: "Admission sous statut / Régularisation",
        fields: [t("numeroMatricule", "Numéro matricule"), t("grade", "Grade admission sous statut"), ...actFields()],
      },
      { kind: "promotions", key: "promotions", code: "C", title: "Avancements dans différents grades", hint: "Une entrée par promotion (Grade promotion 1, 2, 3…), sans limite." },
      { kind: "fields", key: "gradeStatutaire", code: "D", title: "Grade statutaire", fields: [t("grade", "Grade"), ...actFields()] },
      { kind: "fields", key: "gradeFonction", code: "E", title: "Grade fonction", fields: [t("grade", "Grade"), ...actFields()] },
      {
        kind: "fields",
        key: "affectation",
        code: "F",
        title: "Affectation actuelle",
        hint: "Déclaration de l'agent : elle ne modifie ni ses fonctions, ni son POOL, ni sa cellule dans l'application.",
        fields: [
          t("ministere", "Ministère / Institution"),
          t("secretariat", "Secrétariat général"),
          t("services", "Services (centraux / provinciaux)"),
          t("province", "Province de l'institution / services"),
          t("ville", "Ville de l'institution"),
          t("directionGenerale", "Direction générale"),
          t("direction", "Direction"),
          t("division", "Division"),
          t("bureau", "Bureau"),
          t("service", "Service"),
        ],
      },
      {
        kind: "fields",
        key: "commission",
        code: "G",
        title: "Commission d'affectation",
        fields: [yn("possede", "Avez-vous une commission d'affectation (OUI / NON)"), t("actReference", "Référence acte"), d("actSignedAt", "Date signature d'acte"), t("actSignatory", "Signataire acte")],
      },
      {
        kind: "fields",
        key: "transfert",
        code: "H",
        title: "Transfert",
        fields: [actFields()[0], t("ministereProvenance", "Ministère de provenance"), ...actFields().slice(1)],
      },
      {
        kind: "fields",
        key: "mutation",
        code: "I",
        title: "Mutation",
        fields: [actFields()[0], t("provinceProvenance", "Province de provenance"), ...actFields().slice(1)],
      },
    ],
  },
  {
    key: "famille",
    roman: "III",
    title: "Information familiale",
    sensitive: true,
    groups: [
      {
        kind: "fields",
        key: "etatCivil",
        code: "1 · A",
        title: "État civil et acte",
        fields: [
          {
            key: "etatCivil",
            label: "État civil",
            kind: "choice",
            options: [
              { value: "CELIBATAIRE", label: "Célibataire" },
              { value: "MARIE", label: "Marié(e)" },
              { value: "VEUF", label: "Veuf (veuve)" },
              { value: "DIVORCE", label: "Divorcé(e)" },
            ],
          },
          t("acteNature", "Nature acte (attestation de célibat, acte de mariage, attestation de veuvage, jugement de divorce)"),
          t("acteReference", "Référence acte"),
          d("acteSignedAt", "Date de signature de l'acte"),
          t("acteLieu", "Lieu de signature de l'acte (Commune / Ville / Pays)"),
          t("acteSignataire", "Signataire de l'acte"),
          d("acteDelivreLe", "Date de délivrance"),
          t("acteEntite", "Entité de délivrance"),
        ],
      },
      {
        kind: "fields",
        key: "conjoint",
        code: "B",
        title: "Conjoint(e)",
        fields: [
          t("nom", "Nom"),
          t("postnom", "Post-nom"),
          t("prenom", "Prénom"),
          { key: "sexe", label: "Sexe", kind: "choice", options: SEX_OPTIONS },
          d("dateNaissance", "Date de naissance"),
          t("lieuNaissance", "Lieu de naissance (Ville et Pays)"),
          t("nationalite", "Nationalité"),
          t("profession", "Profession"),
        ],
      },
      { kind: "fields", key: "origineConjoint", code: "C", title: "Origine du conjoint(e) de l'agent", fields: originFields(true) },
      {
        kind: "fields",
        key: "nombreEnfants",
        code: "D",
        title: "Nombre d'enfants",
        hint: "Livret de ménage, composition familiale ou actes de naissance des enfants.",
        fields: [
          { key: "nombreEnfants", label: "En chiffres", kind: "number", userColumn: "nombreEnfants" },
          t("enLettres", "En lettres"),
        ],
      },
      { kind: "children", key: "enfants", code: "E", title: "Fiche d'informations sur les enfants de l'agent", hint: "Une ligne par enfant, sans limite." },
    ],
  },
  {
    key: "etudes",
    roman: "IV",
    title: "Niveau d'étude",
    groups: [{ kind: "diplomas", key: "diplomes", code: "A-G", title: "Titres et diplômes", hint: "Du doctorat au certificat d'études primaires ; aucun niveau n'est obligatoire." }],
  },
  {
    key: "remuneration",
    roman: "V",
    title: "Rémunération",
    sensitive: true,
    groups: [
      {
        kind: "fields",
        key: "remuneration",
        code: "1-15",
        title: "Rémunération, recensement et CNSSAP",
        fields: [
          yn("salaireBase", "Payé en salaire de base (OUI / NON)"),
          yn("prime", "Payé en prime (OUI / NON)"),
          { key: "primes", label: "Nature des primes (une par ligne)", kind: "list" },
          yn("recense", "Recensé (OUI / NON)"),
          yn("carteBiometrique", "Possession carte biométrique (OUI / NON)"),
          t("numeroCarteBiometrique", "N° carte biométrique"),
          yn("recenseCnssap", "Recensé à la CNSSAP (OUI / NON)"),
          yn("carteCnssap", "Possession carte biométrique de la CNSSAP (OUI / NON)"),
          t("numeroCarteCnssap", "N° carte biométrique de la CNSSAP"),
        ],
      },
    ],
  },
  {
    key: "position",
    roman: "VI",
    title: "Position administrative",
    groups: [
      {
        kind: "fields",
        key: "position",
        code: "A · 1",
        title: "Position et autre position",
        fields: [
          {
            key: "position",
            label: "Position",
            kind: "choice",
            options: [
              { value: "ACTIVITE", label: "Activité" },
              { value: "DETACHEMENT", label: "Détachement" },
              { value: "DISPONIBILITE", label: "Disponibilité" },
              { value: "SUSPENSION", label: "Suspension" },
            ],
          },
          t("actNature", "Autre position — nature acte"),
          t("actReference", "Référence acte"),
          d("actSignedAt", "Date signature d'acte"),
          t("duree", "Durée"),
        ],
      },
    ],
  },
  {
    key: "materiel",
    roman: "VII",
    title: "Information sur le matériel roulant",
    groups: [
      {
        kind: "fields",
        key: "materielIdentification",
        code: "A",
        title: "Identification complète du matériel (véhicule, moto, etc.)",
        hint: "À laisser vide si l'agent n'est pas concerné.",
        fields: [t("marque", "Marque"), t("modele", "Modèle"), t("type", "Type"), t("categorie", "Catégorie"), t("couleur", "Couleur"), { key: "annee", label: "Année de fabrication", kind: "year" }, t("chassis", "Numéro de châssis")],
      },
      {
        kind: "fields",
        key: "materielSituation",
        code: "B",
        title: "Situation administrative du matériel roulant",
        fields: [
          t("plaque", "Numéro de plaque"),
          t("typePlaque", "Type de plaque : civile / administrative / militaire, etc."),
          t("feuilleRoute", "Feuille de route (si administrative, militaire, etc.)"),
          t("autorisationConduite", "Autorisation de conduite (si administrative, militaire)"),
          t("carteRose", "Carte rose ou volet jaune (si civile)"),
        ],
      },
      {
        kind: "fields",
        key: "materielConducteur",
        code: "C",
        title: "Identification du conducteur / propriétaire",
        fields: [t("nom", "Nom du conducteur / propriétaire"), t("permis", "Permis de conduire (national / étranger)"), d("delivreLe", "Date de délivrance"), d("expireLe", "Date d'expiration"), t("lien", "Lien avec le véhicule")],
      },
    ],
  },
];

export const STUDY_LEVELS = [
  { value: "PHD", label: "Niveau PhD", optionLabel: "Filière" },
  { value: "MASTER", label: "Niveau DEA / Master", optionLabel: "Filière" },
  { value: "LICENCE", label: "Niveau Licence (BAC+5)", optionLabel: "Filière" },
  { value: "GRADUAT", label: "Niveau Graduat (BAC+3)", optionLabel: "Filière" },
  { value: "D6", label: "Niveau D6", optionLabel: "Option / Section" },
  { value: "POST_PRIMAIRE", label: "Niveau post d'études primaires", optionLabel: "Option / Section" },
  { value: "PRIMAIRE", label: "Niveau primaire (dernière année)", optionLabel: null },
] as const;

export const CHILD_RELATIONS = [
  { value: "BIOLOGIQUE", label: "Enfant biologique", short: "EBio" },
  { value: "ADOPTIF", label: "Enfant adoptif", short: "EAd" },
  { value: "SOUS_TUTELLE", label: "Enfant sous tutelle", short: "EST" },
] as const;

// Colonnes des entrées répétables (clé = colonne de la table Prisma).
export const PROMOTION_FIELDS: readonly FieldDef[] = [
  t("grade", "Grade"),
  t("actNature", "Nature acte (Décision, Arrêté, Décret, Ord…)"),
  t("actReference", "Référence acte"),
  d("actSignedAt", "Date de signature de l'acte"),
  t("actSignatory", "Signataire de l'acte"),
  t("notifReference", "Référence notification"),
  d("notifDate", "Date de notification"),
  t("notifSignatory", "Signataire de la notification d'acte"),
];

export const DIPLOMA_FIELDS: readonly FieldDef[] = [
  { key: "level", label: "Niveau", kind: "choice", options: STUDY_LEVELS.map((l) => ({ value: l.value, label: l.label })) },
  t("field", "Filière / Option / Section"),
  { key: "year", label: "Année d'obtention", kind: "year" },
  t("documentNature", "Nature pièce (document)"),
  t("documentReference", "Référence pièce"),
  d("issuedAt", "Date de délivrance pièce"),
  t("institutionName", "Nom de l'institution"),
  t("institutionCommune", "Commune de l'institution"),
  t("institutionCity", "Ville de l'institution"),
  t("institutionProvince", "Province de l'institution"),
  t("institutionCountry", "Pays de l'institution"),
  t("institutionContinent", "Continent de l'établissement"),
];

export const CHILD_FIELDS: readonly FieldDef[] = [
  t("nom", "Nom"),
  t("postnom", "Post-nom"),
  t("prenom", "Prénom"),
  { key: "sex", label: "Sexe", kind: "choice", options: SEX_OPTIONS },
  d("birthDate", "Date de naissance"),
  t("birthPlace", "Lieu de naissance (Ville et Pays)"),
  t("nationality", "Nationalité"),
  t("profession", "Profession"),
  { key: "relation", label: "Observation (EBio, EAd, EST)", kind: "choice", options: CHILD_RELATIONS.map((r) => ({ value: r.value, label: `${r.short} — ${r.label}` })) },
];

export const REPEAT_FIELDS = { promotions: PROMOTION_FIELDS, diplomas: DIPLOMA_FIELDS, children: CHILD_FIELDS } as const;

/** Toutes les rubriques, à plat (clé unique dans la fiche). */
export const ALL_GROUPS: readonly GroupDef[] = PERSONNEL_FILE_SECTIONS.flatMap((s) => s.groups);

export function findFieldsGroup(key: string): FieldsGroup | null {
  const g = ALL_GROUPS.find((x) => x.key === key);
  return g && g.kind === "fields" ? g : null;
}

export function sectionOfGroup(groupKey: string): SectionDef | null {
  return PERSONNEL_FILE_SECTIONS.find((s) => s.groups.some((g) => g.key === groupKey)) ?? null;
}

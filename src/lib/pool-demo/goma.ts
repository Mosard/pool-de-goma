import type { PoolShowcase } from "@/lib/pool-showcase";

// MAQUETTE — DONNÉES ET PORTRAITS FICTIFS.
// Aucune de ces personnes, écoles ou coordonnées n'existe : elles illustrent
// la présentation de la page POOL en attendant les données officielles.
// Noms réduits à un prénom + initiale, écoles « exemple », e-mail en
// .invalid (domaine réservé) pour qu'aucune donnée réelle ne soit désignée.
// Portraits : illustrations SVG fictives dans public/demo/pools/goma/.

const PORTRAITS = "/demo/pools/goma";

export const GOMA_DEMO: PoolShowcase = {
  mode: "demo",
  slug: "goma",
  name: "Goma",
  address: "Adresse fictive — exemple, Goma",
  email: "bureau.exemple@pool-goma.invalid",
  chief: {
    key: "demo-chef",
    name: "Grâce M.",
    functionLabel: "Chef de POOL",
    photo: `${PORTRAITS}/chef.svg`,
    schools: [],
  },
  staff: [
    {
      key: "demo-1",
      name: "Josué K.",
      functionLabel: "Inspecteur itinérant",
      photo: `${PORTRAITS}/agent-1.svg`,
      schools: ["École exemple A", "École exemple C"],
    },
    {
      key: "demo-2",
      name: "Nadine B.",
      functionLabel: "Inspectrice itinérante",
      photo: `${PORTRAITS}/agent-2.svg`,
      schools: ["École exemple B", "École exemple D"],
    },
    {
      key: "demo-3",
      name: "Patrick S.",
      functionLabel: "Inspecteur itinérant",
      photo: `${PORTRAITS}/agent-3.svg`,
      schools: ["École exemple E"],
    },
    {
      key: "demo-4",
      name: "Rachel T.",
      functionLabel: "Secrétaire du POOL",
      photo: `${PORTRAITS}/agent-4.svg`,
      schools: [],
    },
  ],
  schools: [
    { name: "École exemple A", address: "Adresse fictive n° 1, Goma" },
    { name: "École exemple B", address: "Adresse fictive n° 2, Goma" },
    { name: "École exemple C", address: "Adresse fictive n° 3, Goma" },
    { name: "École exemple D", address: "Adresse fictive n° 4, Goma" },
    { name: "École exemple E", address: "Adresse fictive n° 5, Goma" },
  ],
};

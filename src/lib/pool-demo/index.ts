import type { PoolShowcase } from "@/lib/pool-showcase";
import { GOMA_DEMO } from "./goma";

// Registre des MAQUETTES de pages POOL (données et portraits fictifs).
// Une maquette n'est affichée que tant que le POOL n'a aucun contenu
// officiel publié (voir resolvePoolPage), jamais mélangée aux données réelles.
//
// Pour retirer la maquette de Goma : supprimer l'entrée ci-dessous, le
// fichier ./goma.ts et le dossier public/demo/pools/goma/.
export const DEMO_POOL_SHOWCASES: Record<string, PoolShowcase> = {
  goma: GOMA_DEMO,
};

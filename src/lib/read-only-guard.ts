// Règle PURE du mode consultation (décision du 2026-10-12) : pendant une
// bascule « Voir comme » d'un informaticien ou d'un secrétaire de l'IPP,
// aucune écriture en base n'aboutit. Seul le journal d'audit reste écrit :
// les consultations (fiches, changements de bascule) y sont tracées.

import { viewModeKind } from "@/lib/rbac-data";

export const WRITE_OPERATIONS: readonly string[] = [
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
];

/** Modèles toujours inscriptibles pendant la consultation (traçabilité). */
export const READ_ONLY_WRITABLE_MODELS: readonly string[] = ["AuditLog"];

export function isWriteOperation(operation: string): boolean {
  return WRITE_OPERATIONS.includes(operation);
}

/** Écriture à refuser : bascule active, compte en consultation, modèle non exempté. */
export function shouldBlockWrite(p: { model: string | undefined; operation: string; viewModeActive: boolean; realRoleKeys: readonly string[] }): boolean {
  if (!p.viewModeActive || !isWriteOperation(p.operation)) return false;
  if (p.model && READ_ONLY_WRITABLE_MODELS.includes(p.model)) return false;
  return viewModeKind(p.realRoleKeys) === "readonly";
}

"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Select } from "@/components/ui";
import { approveAccountRequestAction, rejectAccountRequestAction, type ReviewState } from "./actions";
import { ActivationNotice } from "./activation-notice";

type RoleOption = { id: string; label: string; scope: string };
type PoolOption = { id: string; name: string };

const initialState: ReviewState = {};

/**
 * Validation d'une demande : l'administrateur confirme (ou corrige) la
 * fonction et le POOL demandés — la demande publique n'accorde rien d'office.
 */
export function RequestReview({
  requestId,
  requestedRoleId,
  requestedPoolId,
  roles,
  pools,
}: {
  requestId: string;
  requestedRoleId: string | null;
  requestedPoolId: string | null;
  roles: RoleOption[];
  pools: PoolOption[];
}) {
  const router = useRouter();
  const [approveState, approveAction, approving] = useActionState(
    approveAccountRequestAction.bind(null, requestId),
    initialState
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectAccountRequestAction.bind(null, requestId),
    initialState
  );
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const defaultRole = roles.some((r) => r.id === requestedRoleId) ? requestedRoleId! : "";
  const [roleId, setRoleId] = useState(defaultRole);
  const role = roles.find((r) => r.id === roleId);

  if (approveState.done === "approved" && approveState.activated) {
    return (
      <Alert variant="success">
        Compte {approveState.isDemo ? "de démonstration " : ""}validé et actif. La personne se connecte dès maintenant
        avec son identifiant <strong className="font-mono">{approveState.username}</strong> et le mot de passe
        qu&apos;elle a choisi.
        <Button type="button" variant="ghost" className="ml-2 !min-h-0 !px-2 !py-1 text-xs" onClick={() => router.refresh()}>
          Terminé
        </Button>
      </Alert>
    );
  }

  if (approveState.done === "approved" && approveState.email) {
    return (
      <ActivationNotice
        email={approveState.email}
        emailed={approveState.emailed}
        isDemo={approveState.isDemo}
        activationUrl={approveState.activationUrl}
        expiresAt={approveState.expiresAt}
        onDone={() => router.refresh()}
      />
    );
  }

  const error = mode === "reject" ? rejectState.error : approveState.error;

  return (
    <div className="space-y-2 text-left">
      {mode === "idle" && (
        <div className="flex justify-end gap-2">
          <Button type="button" className="!min-h-0 px-3 py-1.5 text-xs" onClick={() => setMode("approve")}>
            Valider
          </Button>
          <Button type="button" variant="danger" className="!min-h-0 px-3 py-1.5 text-xs" onClick={() => setMode("reject")}>
            Refuser
          </Button>
        </div>
      )}

      {mode === "approve" && (
        <form action={approveAction} className="flex flex-wrap items-center justify-end gap-2">
          <Select
            name="roleId"
            required
            aria-label="Fonction attribuée"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="!w-auto text-xs"
          >
            <option value="" disabled>Fonction…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </Select>
          <Select
            name="poolId"
            aria-label="POOL de rattachement"
            defaultValue={requestedPoolId ?? ""}
            required={role?.scope === "POOL"}
            className="!w-auto text-xs"
          >
            <option value="">{role?.scope === "POOL" ? "POOL…" : "Aucun POOL"}</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Button type="submit" className="!min-h-0 !px-3 !py-1.5 text-xs" disabled={approving}>
            {approving ? "Validation…" : "Confirmer"}
          </Button>
          <Button type="button" variant="ghost" className="!min-h-0 !px-3 !py-1.5 text-xs" onClick={() => setMode("idle")}>
            Annuler
          </Button>
        </form>
      )}

      {mode === "reject" && (
        <form action={rejectAction} className="flex items-center justify-end gap-2">
          <span className="text-xs text-gray-500">Refuser cette demande ?</span>
          <Button type="submit" variant="danger" className="!min-h-0 !px-3 !py-1.5 text-xs" disabled={rejecting}>
            {rejecting ? "Refus…" : "Refuser"}
          </Button>
          <Button type="button" variant="ghost" className="!min-h-0 !px-3 !py-1.5 text-xs" onClick={() => setMode("idle")}>
            Annuler
          </Button>
        </form>
      )}

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}

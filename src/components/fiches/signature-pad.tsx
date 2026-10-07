"use client";

// Signature tracée au doigt sur l'écran (décision Q6). La signature est
// enregistrée en image PNG avec le nom, le lieu et la date ; le refus de
// signer est acté avec deux témoins qui signent à leur tour [module,
// « Signature du rapport »].

import { useEffect, useRef, useState } from "react";
import type { SignatureValue } from "@/lib/fiches/types";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50";

/** Zone de tracé : renvoie une image PNG (data URL) à chaque trait terminé. */
export function Pad({ value, onChange, disabled, height = 140 }: { value?: string; onChange: (image: string | undefined) => void; disabled?: boolean; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
    }
    // Le tracé initial ne se redessine qu'au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ height, touchAction: "none" }}
        className={`w-full rounded-xl border-2 border-dashed ${disabled ? "border-gray-200 bg-gray-50" : "border-gray-300 bg-white"}`}
        aria-label="Zone de signature"
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = point(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || disabled) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = point(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={(e) => {
          if (!drawing.current) return;
          drawing.current = false;
          setEmpty(false);
          onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      {!disabled && (
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>{empty ? "Signer avec le doigt dans le cadre." : "Signature enregistrée."}</span>
          <button
            type="button"
            className="font-medium text-blue-600 hover:underline"
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
              setEmpty(true);
              onChange(undefined);
            }}
          >
            Effacer
          </button>
        </div>
      )}
    </div>
  );
}

export function SignatureField({
  label,
  mention,
  allowRefusal,
  value,
  onChange,
  disabled,
}: {
  label: string;
  mention?: string;
  allowRefusal?: boolean;
  value?: SignatureValue;
  onChange: (v: SignatureValue | undefined) => void;
  disabled?: boolean;
}) {
  const v: SignatureValue = value ?? { name: "", signedAt: "" };
  const update = (patch: Partial<SignatureValue>) => onChange({ ...v, ...patch, signedAt: new Date().toISOString() });
  const witnesses = v.witnesses ?? [{ name: "" }, { name: "" }];

  if (disabled && !value) {
    return (
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="mt-1 text-xs text-gray-400">Non signé.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      {mention && <p className="text-xs italic text-gray-500">{mention}</p>}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input className={inputClass} placeholder="Nom" value={v.name} disabled={disabled} onChange={(e) => update({ name: e.target.value })} />
        <input className={inputClass} placeholder="Fait à" value={v.place ?? ""} disabled={disabled} onChange={(e) => update({ place: e.target.value })} />
        <input className={inputClass} type="date" value={v.date ?? ""} disabled={disabled} onChange={(e) => update({ date: e.target.value })} />
      </div>
      {allowRefusal && (
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={Boolean(v.refused)} disabled={disabled} onChange={(e) => update({ refused: e.target.checked, image: e.target.checked ? undefined : v.image })} />
          Refus de signer
        </label>
      )}
      {v.refused ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-600">« Refus de signer » acté : la fiche est contresignée par deux témoins.</p>
          {witnesses.map((w, i) => (
            <div key={i} className="rounded-lg bg-gray-50 p-3">
              <input
                className={inputClass}
                placeholder={`Témoin ${i + 1} : nom`}
                value={w.name}
                disabled={disabled}
                onChange={(e) => update({ witnesses: witnesses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
              />
              <div className="mt-2">
                <Pad value={w.image} disabled={disabled} height={110} onChange={(image) => update({ witnesses: witnesses.map((x, j) => (j === i ? { ...x, image } : x)) })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <Pad value={v.image} disabled={disabled} onChange={(image) => update({ image })} />
        </div>
      )}
    </div>
  );
}

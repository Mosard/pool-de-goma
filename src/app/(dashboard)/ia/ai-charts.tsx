"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

// Étage 1 : une série par graphique (jamais deux échelles sur un même axe).
// Les effectifs (n) suivent chaque valeur dans l'info-bulle et le tableau.

export type ChartPoint = { label: string; rapports: number; valeur: number | null; n: number };

const SERIES = "#2563eb";
const GRID = "#e5e7eb";
const TICK = { fontSize: 12, fill: "#6b7280" };

function format(v: number | null, unit: string): string {
  if (v === null) return "—";
  return `${v.toLocaleString("fr-FR")}${unit}`;
}

function PointTooltip({
  active,
  payload,
  measure,
  unit,
}: Partial<TooltipContentProps<number, string>> & { measure: "rapports" | "valeur"; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ChartPoint;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-gray-900">{p.label}</p>
      {measure === "rapports" ? (
        <p className="text-gray-700">{p.rapports.toLocaleString("fr-FR")} rapport(s)</p>
      ) : (
        <>
          <p className="text-gray-700">{format(p.valeur, unit)}</p>
          <p className="text-gray-500">
            n = {p.n} rapport(s) renseigné(s) sur {p.rapports}
          </p>
        </>
      )}
    </div>
  );
}

export function TrendChart({ data, measure, unit = "" }: { data: ChartPoint[]; measure: "rapports" | "valeur"; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={measure === "valeur"} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<PointTooltip measure={measure} unit={unit} />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey={measure}
          stroke={SERIES}
          strokeWidth={2}
          dot={{ r: 4, fill: SERIES, stroke: "#fff", strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompareChart({ data, measure, unit = "" }: { data: ChartPoint[]; measure: "rapports" | "valeur"; unit?: string }) {
  // Barres horizontales : les noms d'écoles restent lisibles sur téléphone.
  const height = Math.max(160, data.length * 34 + 24);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={measure === "valeur"} tick={TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={130} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<PointTooltip measure={measure} unit={unit} />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey={measure} fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

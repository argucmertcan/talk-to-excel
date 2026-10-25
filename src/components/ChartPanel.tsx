"use client";
import { motion } from "framer-motion";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { View } from "@/lib/ops";
import { formatCell, formatCompact } from "@/lib/format";

const COLORS = ["#4ade80", "#38bdf8", "#fbbf24", "#f472b6", "#a78bfa", "#fb7185", "#2dd4bf", "#facc15"];

export function ChartPanel({ view, onClose }: { view: View; onClose: () => void }) {
  const spec = view.chart!;
  const cols = Object.fromEntries(view.columns.map((c) => [c.name, c]));
  const ys = spec.ys.filter((y) => cols[y]);
  const data = view.rows.slice(0, 40).map((r) => ({
    x: String(formatCell(r[spec.x], cols[spec.x]) || "—"),
    ...Object.fromEntries(ys.map((y) => [y, typeof r[y] === "number" ? r[y] : 0])),
  }));
  const kind = cols[ys[0]]?.kind;
  const tick = { fill: "#8a9bb8", fontSize: 12.6 };
  const tooltip = (
    <Tooltip
      contentStyle={{ background: "#16223a", border: "1px solid #22314d", borderRadius: 12, fontSize: 16.8 }}
      formatter={(v: number, name: string) => [formatCell(v, cols[name]), name]}
    />
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      className="rounded-2xl border border-line bg-panel p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{spec.title}</h3>
        <button onClick={onClose} className="text-sm text-muted hover:text-white">Gizle ✕</button>
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          {spec.chart === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey={ys[0]} nameKey="x" innerRadius={60} outerRadius={110} paddingAngle={2} animationDuration={900}
                label={({ name, percent }) => `${name} %${((percent ?? 0) * 100).toFixed(0)}`}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              {tooltip}
            </PieChart>
          ) : spec.chart === "line" ? (
            <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid stroke="#22314d" vertical={false} />
              <XAxis dataKey="x" tick={tick} />
              <YAxis tick={tick} tickFormatter={(v) => formatCompact(v, kind)} width={80} />
              {tooltip}
              {ys.length > 1 && <Legend wrapperStyle={{ fontSize: 16.8 }} />}
              {ys.map((y, i) => (
                <Line key={y} type="monotone" dataKey={y} stroke={COLORS[i]} strokeWidth={3} dot={{ r: 4 }} animationDuration={1200} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid stroke="#22314d" vertical={false} />
              <XAxis dataKey="x" tick={tick} interval={0} angle={data.length > 8 ? -20 : 0} textAnchor={data.length > 8 ? "end" : "middle"} height={data.length > 8 ? 60 : 30} />
              <YAxis tick={tick} tickFormatter={(v) => formatCompact(v, kind)} width={80} />
              {tooltip}
              {ys.length > 1 && <Legend wrapperStyle={{ fontSize: 16.8 }} />}
              {ys.map((y, i) => (
                <Bar key={y} dataKey={y} fill={COLORS[i]} radius={[6, 6, 0, 0]} animationDuration={900} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

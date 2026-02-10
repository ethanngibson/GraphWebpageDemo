import { useMemo, useState } from "react";
import { profilerSnapshot } from "./fakeProfilerData";

type Span = {
  id: string;
  lane: string; // e.g. "CPU" or "GPU stream 7"
  label: string;
  kind: string;
  start: number; // ms
  end: number; // ms
  data: any; // original node
};

type LaneLayout = {
  lane: string;
  rows: Span[][]; // packed rows of spans (no overlaps within a row)
};

function formatBytes(bytes?: number) {
  if (bytes == null) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function labelForNode(n: any): string {
  switch (n.kind) {
    case "cpu_object":
      return `${n.class ?? "cpu_object"} (${formatBytes(n.size_bytes)})`;
    case "gpu_allocation":
      return `gpu_alloc ${n.alloc ?? "cudaMalloc"} (${formatBytes(n.size_bytes)})`;
    case "kernel":
      return `kernel ${n.name ?? ""} (${n.duration_us ?? 0} µs)`;
    case "memcpy":
      return `memcpy ${n.direction ?? ""} (${formatBytes(n.size_bytes)})`;
    default:
      return String(n.id ?? "node");
  }
}

function getStartEndMs(n: any): { start: number; end: number } | null {
  // Lifetimes
  if (n.kind === "cpu_object" || n.kind === "gpu_allocation") {
    const start = n.created_at_ms;
    const end = n.freed_at_ms; // may be undefined
    if (typeof start === "number") {
      // end handled later (we'll clamp to window end if missing)
      return { start, end: typeof end === "number" ? end : start };
    }
  }

  // Timed events
  if (n.kind === "kernel") {
    const start = n.started_at_ms;
    const durMs = (n.duration_us ?? 0) / 1000;
    if (typeof start === "number") return { start, end: start + durMs };
  }

  if (n.kind === "memcpy") {
    const start = n.started_at_ms;
    const durMs = (n.duration_us ?? 0) / 1000;
    if (typeof start === "number") return { start, end: start + durMs };
  }

  return null;
}

function laneForNode(n: any): string {
  if (n.kind === "cpu_object") return "CPU";
  if (n.kind === "gpu_allocation" || n.kind === "kernel" || n.kind === "memcpy") {
    const s = typeof n.stream === "number" ? n.stream : "unknown";
    return `GPU stream ${s}`;
  }
  return "Other";
}

// Greedy interval packing: put each span into the first row it fits (no overlap in that row).
function packIntoRows(spans: Span[]): Span[][] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const rows: Span[][] = [];

  for (const sp of sorted) {
    let placed = false;

    for (const row of rows) {
      const last = row[row.length - 1];
      // If this span starts after the last ends, it can go in this row
      if (sp.start >= last.end) {
        row.push(sp);
        placed = true;
        break;
      }
    }

    if (!placed) rows.push([sp]);
  }

  return rows;
}

// Deterministic color from string (no hard-coded palette)
function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 55%)`;
}

export default function FlamegraphPage() {
  const [hover, setHover] = useState<Span | null>(null);
  const [selected, setSelected] = useState<Span | null>(null);

  const { lanes, windowStart, windowEnd } = useMemo(() => {
    const nodes = profilerSnapshot.nodes as any[];

    // Build spans from nodes
    const rawSpans: Span[] = [];
    for (const n of nodes) {
      const se = getStartEndMs(n);
      if (!se) continue;

      rawSpans.push({
        id: String(n.id),
        lane: laneForNode(n),
        label: labelForNode(n),
        kind: String(n.kind),
        start: se.start,
        end: se.end,
        data: n,
      });
    }

    // Compute global window
    let minT = Number.POSITIVE_INFINITY;
    let maxT = Number.NEGATIVE_INFINITY;

    for (const sp of rawSpans) {
      minT = Math.min(minT, sp.start);
      maxT = Math.max(maxT, sp.end);
      // If allocations have end==start (because freed_at_ms missing), they won’t show.
      // We'll expand them to window end after computing maxT.
      if (sp.kind === "cpu_object" || sp.kind === "gpu_allocation") {
        const freed = sp.data?.freed_at_ms;
        if (typeof freed === "number") maxT = Math.max(maxT, freed);
      }
    }

    if (!isFinite(minT) || !isFinite(maxT) || minT === maxT) {
      minT = 0;
      maxT = 1;
    }

    // If allocation lifetimes have no freed_at_ms, extend them to the window end for visibility
    const spans: Span[] = rawSpans.map((sp) => {
      if ((sp.kind === "cpu_object" || sp.kind === "gpu_allocation") && sp.data?.freed_at_ms == null) {
        return { ...sp, end: maxT };
      }
      return sp;
    });

    // Group by lane and pack rows
    const laneMap = new Map<string, Span[]>();
    for (const sp of spans) {
      if (!laneMap.has(sp.lane)) laneMap.set(sp.lane, []);
      laneMap.get(sp.lane)!.push(sp);
    }

    // Order lanes: CPU first, then GPU streams numeric order, then Other
    const laneNames = [...laneMap.keys()].sort((a, b) => {
      if (a === "CPU") return -1;
      if (b === "CPU") return 1;
      if (a === "Other") return 1;
      if (b === "Other") return -1;

      const ra = a.match(/GPU stream (\d+)/);
      const rb = b.match(/GPU stream (\d+)/);
      if (ra && rb) return Number(ra[1]) - Number(rb[1]);
      return a.localeCompare(b);
    });

    const lanes: LaneLayout[] = laneNames.map((lane) => ({
      lane,
      rows: packIntoRows(laneMap.get(lane)!),
    }));

    return { lanes, windowStart: minT, windowEnd: maxT };
  }, []);

  const width = 980;
  const rowH = 22;
  const rowGap = 4;
  const laneTitleW = 140;
  const laneGap = 14;

  const totalRows = useMemo(() => lanes.reduce((sum, l) => sum + l.rows.length, 0), [lanes]);
  const height = Math.max(240, lanes.length * laneGap + totalRows * (rowH + rowGap) + 40);

  const windowDur = Math.max(1e-6, windowEnd - windowStart);

  // Build a flat list of rects to render with y positions
  const rects = useMemo(() => {
    const out: Array<Span & { x: number; y: number; w: number; h: number; laneRow: number; laneIndex: number }> = [];

    let y = 18;
    lanes.forEach((laneLayout, laneIndex) => {
      // lane label baseline
      const laneStartY = y;

      laneLayout.rows.forEach((row, laneRow) => {
        row.forEach((sp) => {
          const x = laneTitleW + ((sp.start - windowStart) / windowDur) * width;
          const w = ((sp.end - sp.start) / windowDur) * width;
          out.push({
            ...sp,
            x,
            y: laneStartY + laneRow * (rowH + rowGap),
            w: Math.max(2, w),
            h: rowH,
            laneRow,
            laneIndex,
          });
        });
      });

      y = laneStartY + laneLayout.rows.length * (rowH + rowGap) + laneGap;
    });

    return out;
  }, [lanes, windowStart, windowDur, width]);

  return (
    <div style={styles.shell}>
      <div style={styles.left}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Flamegraph (time-based)</div>
            <div style={styles.sub}>
              Built from <code>profilerSnapshot</code>: allocations are lifetimes, kernels/memcpy are timed events.
              Hover for tooltip, click to pin details.
            </div>
          </div>
          <button style={styles.btn} onClick={() => setSelected(null)} disabled={!selected}>
            Clear selection
          </button>
        </div>

        <div style={styles.chartWrap}>
          <svg
            width={laneTitleW + width + 24}
            height={height}
            onMouseLeave={() => setHover(null)}
            style={{ display: "block" }}
          >
            {/* background */}
            <rect x={0} y={0} width="100%" height="100%" fill="rgba(255,255,255,0.03)" />

            {/* time axis */}
            <g>
              <text x={laneTitleW} y={14} fontSize="11" fill="rgba(232,234,240,0.85)">
                t = {windowStart.toFixed(1)} ms
              </text>
              <text
                x={laneTitleW + width - 2}
                y={14}
                fontSize="11"
                textAnchor="end"
                fill="rgba(232,234,240,0.85)"
              >
                t = {windowEnd.toFixed(1)} ms
              </text>
              <line
                x1={laneTitleW}
                y1={18}
                x2={laneTitleW + width}
                y2={18}
                stroke="rgba(255,255,255,0.10)"
              />
            </g>

            {/* lane labels */}
            {(() => {
              let y = 18;
              return lanes.map((l, i) => {
                const laneY = y + 12;
                const laneHeight = l.rows.length * (rowH + rowGap);
                y = y + laneHeight + laneGap;

                return (
                  <g key={l.lane}>
                    <text
                      x={10}
                      y={laneY}
                      fontSize="12"
                      fill="rgba(232,234,240,0.9)"
                      style={{ fontWeight: 800 }}
                    >
                      {l.lane}
                    </text>
                    <line
                      x1={laneTitleW}
                      y1={y - laneGap + 6}
                      x2={laneTitleW + width}
                      y2={y - laneGap + 6}
                      stroke="rgba(255,255,255,0.06)"
                    />
                  </g>
                );
              });
            })()}

            {/* spans */}
            {rects.map((r) => {
              const fill = colorFromString(r.kind + r.label + r.lane);
              const isSelected = selected?.id === r.id && selected?.start === r.start && selected?.end === r.end;

              return (
                <g
                  key={`${r.id}:${r.start}:${r.end}:${r.lane}`}
                  onMouseEnter={() => setHover(r)}
                  onClick={() => setSelected(r)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    rx={6}
                    fill={fill}
                    opacity={isSelected ? 0.95 : 0.75}
                    stroke={isSelected ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.25)"}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                  {/* label if wide enough */}
                  {r.w > 90 && (
                    <text x={r.x + 8} y={r.y + 15} fontSize="12" fill="rgba(0,0,0,0.85)">
                      {r.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* hover tooltip */}
          {hover && (
            <div style={styles.tooltip}>
              <div style={{ fontWeight: 900 }}>{hover.label}</div>
              <div style={{ opacity: 0.85, marginTop: 4, fontSize: 12 }}>
                {hover.lane} • {hover.kind}
              </div>
              <div style={{ opacity: 0.85, marginTop: 6, fontSize: 12 }}>
                {hover.start.toFixed(2)} → {hover.end.toFixed(2)} ms{" "}
                <span style={{ opacity: 0.7 }}>
                  ({Math.max(0, hover.end - hover.start).toFixed(2)} ms)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <aside style={styles.panel}>
        <div style={styles.panelTitle}>Details</div>

        {!selected ? (
          <div style={styles.panelEmpty}>Click a bar to pin its full profiler node data.</div>
        ) : (
          <div style={styles.panelContent}>
            <div style={styles.kv}>
              <div style={styles.k}>label</div>
              <div style={styles.v}>{selected.label}</div>
            </div>
            <div style={styles.kv}>
              <div style={styles.k}>lane</div>
              <div style={styles.v}>{selected.lane}</div>
            </div>
            <div style={styles.kv}>
              <div style={styles.k}>kind</div>
              <div style={styles.v}>{selected.kind}</div>
            </div>
            <div style={styles.kv}>
              <div style={styles.k}>time</div>
              <div style={styles.v}>
                {selected.start.toFixed(2)} → {selected.end.toFixed(2)} ms (
                {Math.max(0, selected.end - selected.start).toFixed(2)} ms)
              </div>
            </div>

            <div style={styles.detailsHeader}>node data</div>
            {Object.entries(selected.data ?? {}).map(([k, v]) => (
              <div key={k} style={styles.kv}>
                <div style={styles.k}>{k}</div>
                <div style={styles.v}>
                  {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    width: "100%",
    height: "100%",
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    background: "#0b1020",
    color: "#e8eaf0",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  },
  left: { padding: 16, overflow: "hidden" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: 900 },
  sub: { marginTop: 6, fontSize: 13, opacity: 0.8, maxWidth: 820 },

  btn: {
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "#e8eaf0",
    cursor: "pointer",
    opacity: 1,
  },

  chartWrap: {
    position: "relative",
    height: "calc(100% - 70px)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    overflow: "auto",
  },

  tooltip: {
    position: "absolute",
    left: 14,
    top: 14,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(8px)",
    pointerEvents: "none",
    maxWidth: 360,
  },

  panel: {
    borderLeft: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(8px)",
    padding: 14,
    overflow: "auto",
  },
  panelTitle: { fontWeight: 900, fontSize: 14, marginBottom: 10 },
  panelEmpty: { opacity: 0.8, fontSize: 13, lineHeight: 1.4 },
  panelContent: { display: "grid", gap: 10 },
  detailsHeader: { marginTop: 4, fontWeight: 900, fontSize: 12, opacity: 0.85 },

  kv: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
  },
  k: { opacity: 0.75, fontSize: 12, textTransform: "capitalize" },
  v: {
    fontSize: 13,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
};

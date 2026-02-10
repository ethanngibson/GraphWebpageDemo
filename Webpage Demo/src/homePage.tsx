import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

import { profilerSnapshot } from "./fakeProfilerData";
import { toReactFlow } from "./toReactFlow";
import { autoLayoutForest } from "./autoLayoutForest";

export default function App() {
  // 1) Build React Flow graph from snapshot
  const { nodes: initNodesRaw, edges: initEdges } = useMemo(
    () => toReactFlow(profilerSnapshot),
    []
  );

  // 2) Auto-layout nodes
  const initNodes = useMemo(() => {
    return autoLayoutForest(initNodesRaw, initEdges);
  }, [initNodesRaw, initEdges]);

  // 3) React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  // 4) Selected node state for the details panel
  const [selected, setSelected] = useState<Node | null>(null);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelected(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelected(null);
  }, []);

  const selectedData = selected?.data ?? null;

  return (
    <div style={styles.shell}>
      <div style={styles.canvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background gap={16} />
        </ReactFlow>

        {/* Re-layout button */}
        <button
          style={styles.relayoutBtn}
          onClick={() => setNodes((nds) => autoLayoutForest(nds, edges))}
          title="Re-run auto layout"
        >
          Auto Layout
        </button>
      </div>

      {/* Details panel */}
      <aside style={styles.panel}>
        <div style={styles.panelHeader}>
          <div style={styles.panelTitle}>Node Details</div>
          <button
            style={{
              ...styles.clearBtn,
              opacity: selected ? 1 : 0.5,
              cursor: selected ? "pointer" : "not-allowed",
            }}
            onClick={() => setSelected(null)}
            disabled={!selected}
            title="Clear selection"
          >
            Clear
          </button>
        </div>

        {!selectedData ? (
          <div style={styles.empty}>Click a node to see its data.</div>
        ) : (
          <div style={styles.content}>
            <div style={styles.kv}>
              <div style={styles.k}>id</div>
              <div style={styles.v}>{selected?.id}</div>
            </div>

            {Object.entries(selectedData).map(([key, val]) => (
              <div style={styles.kv} key={key}>
                <div style={styles.k}>{key}</div>
                <div style={styles.v}>
                  {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
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
    width: "100vw",
    height: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    background: "#0b1020",
    color: "#e8eaf0",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  },
  canvas: { position: "relative" },

  relayoutBtn: {
    position: "absolute",
    zIndex: 10,
    top: 12,
    left: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "#e8eaf0",
    cursor: "pointer",
  },

  panel: {
    borderLeft: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(8px)",
    padding: 14,
    overflow: "auto",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  panelTitle: { fontWeight: 800, fontSize: 14, letterSpacing: 0.2 },
  clearBtn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "#e8eaf0",
  },
  empty: {
    opacity: 0.8,
    fontSize: 13,
    lineHeight: 1.4,
    paddingTop: 8,
  },
  content: { display: "grid", gap: 10 },
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

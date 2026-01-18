import { useCallback, useMemo, useState} from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

// Example nodes + edges (replace with your own)
const initialNodes = [
  { id: "1", position: { x: 0, y: 0 }, data: { label: "Node 1" } },
  { id: "2", position: { x: 220, y: 120 }, data: { label: "Node 2", info: "This is a test information section" } },
  { id: "3", position: { x: 0, y: 220 }, data: { label: "Node 3" } },
  { id: "4", position: { x: 0, y: 220 }, data: { label: "Node 4" } },
  { id: "5", position: { x: 0, y: 220 }, data: { label: "Node 5" } },
  { id: "6", position: { x: 0, y: 220 }, data: { label: "Node 6" } },
  { id: "7", position: { x: 0, y: 220 }, data: { label: "Node 7" } },
  { id: "8", position: { x: 0, y: 220 }, data: { label: "Node 8" } },
  { id: "9", position: { x: 0, y: 220 }, data: { label: "Node 9" } },
  { id: "10", position: { x: 0, y: 220 }, data: { label: "Node 10" } },
];

const initialEdges = [
  { id: "e1-2", source: "1", target: "2"},
  { id: "e1-3", source: "1", target: "3" },
  { id: "e2-4", source: "2", target: "4" },
  { id: "e2-5", source: "2", target: "5" },
  { id: "e4-8", source: "4", target: "8" },
  { id: "e4-5", source: "4", target: "5" },
  { id: "e3-6", source: "3", target: "6" },
  { id: "e6-7", source: "6", target: "7" },
  { id: "e7-8", source: "7", target: "8" },
  { id: "e8-9", source: "8", target: "9" },
  { id: "e9-10", source: "9", target: "10" },

];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
    // selected node info
  const [selected, setSelected] = useState(null);

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

    const onNodeClick = useCallback((_, node) => {
    setSelected(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelected(null);
  }, []);

  const selectedData = useMemo(() => selected?.data ?? null, [selected]);

  return (
    <div style={styles.shell}>
      <div style={styles.canvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
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
      </div>

      <aside style={styles.panel}>
        <div style={styles.panelHeader}>
          <div style={styles.panelTitle}>Node Details</div>
          <button
            style={styles.clearBtn}
            onClick={() => setSelected(null)}
            disabled={!selected}
            title="Clear selection"
          >
            Clear
          </button>
        </div>

        {!selectedData ? (
          <div style={styles.empty}>
            Click a node to see its info.
          </div>
        ) : (
          <div style={styles.content}>
            <div style={styles.kv}>
              <div style={styles.k}>ID</div>
              <div style={styles.v}>{selected.id}</div>
            </div>

            {Object.entries(selectedData).map(([key, val]) => (
              <div style={styles.kv} key={key}>
                <div style={styles.k}>{key}</div>
                <div style={styles.v}>{String(val)}</div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}


const styles = {
  shell: {
    width: "100vw",
    height: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 320px",
    background: "#0b1020",
    color: "#e8eaf0",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  },
  canvas: { position: "relative" },
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
    cursor: "pointer",
    opacity: 1,
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
  v: { fontSize: 13, wordBreak: "break-word" },
};


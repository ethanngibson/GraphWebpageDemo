import type { Node, Edge } from "reactflow";
import type { ProfilerSnapshot, ProfilerNode } from "./fakeProfilerData";

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

function labelFor(n: ProfilerNode): string {
  switch (n.kind) {
    case "cpu_object":
      return n.class;
    case "gpu_allocation":
      return `GPU Mem (${formatBytes(n.size_bytes)})`;
    case "kernel":
      return `Kernel: ${n.name}`;
    case "memcpy":
      return `Memcpy ${n.direction}`;
  }
}

export function toReactFlow(snapshot: ProfilerSnapshot): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = snapshot.nodes.map((n) => ({
    id: n.id,
    data: { label: labelFor(n), ...n },
    position: { x: 0, y: 0 },
  }));

  const edges: Edge[] = snapshot.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.type,
    animated: e.type.includes("transfer"),
  }));

  // quick grid layout
  nodes.forEach((n, i) => {
    n.position = {
      x: (i % 5) * 220,
      y: Math.floor(i / 5) * 160,
    };
  });

  return { nodes, edges };
}

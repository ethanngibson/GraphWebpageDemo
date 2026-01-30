import type { Node, Edge } from "reactflow";

export function autoLayoutForest(
  nodes: Node[],
  edges: Edge[],
  xGap = 240,
  yGap = 170,
  clusterGap = 360
): Node[] {
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Build adjacency and incoming counts
  const children = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  nodes.forEach((n) => {
    children.set(n.id, []);
    incoming.set(n.id, 0);
  });

  edges.forEach((e) => {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return;
    children.get(e.source)!.push(e.target);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  });

  // Roots = nodes with no incoming edges
  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0);

  // BFS per root
  const positions = new Map<string, { x: number; y: number }>();
  let clusterIndex = 0;

  for (const root of roots) {
    const layers = new Map<number, string[]>();
    const depth = new Map<string, number>();
    const queue: string[] = [];

    depth.set(root.id, 0);
    queue.push(root.id);

    while (queue.length) {
      const cur = queue.shift()!;
      const d = depth.get(cur)!;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d)!.push(cur);

      for (const c of children.get(cur) ?? []) {
        if (!depth.has(c)) {
          depth.set(c, d + 1);
          queue.push(c);
        }
      }
    }

    // Position this cluster
    for (const [d, ids] of layers.entries()) {
      ids.forEach((id, i) => {
        positions.set(id, {
          x: clusterIndex * clusterGap + i * xGap,
          y: d * yGap,
        });
      });
    }

    clusterIndex++;
  }

  // Fallback: nodes not placed (cycles or isolated)
  let orphanRow = clusterIndex;
  nodes.forEach((n, i) => {
    if (!positions.has(n.id)) {
      positions.set(n.id, {
        x: i * xGap,
        y: orphanRow * yGap,
      });
    }
  });

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id)!,
  }));
}

export type Kind = "cpu_object" | "gpu_allocation" | "kernel" | "memcpy";

export type ProfilerNode =
  | {
      id: string;
      kind: "cpu_object";
      class: string;
      size_bytes: number;
      ref_count: number;
      gc_gen: number;
      alive: boolean;
      created_at_ms: number;
      tag?: string;
    }
  | {
      id: string;
      kind: "gpu_allocation";
      device: number;
      alloc: string;
      size_bytes: number;
      stream: number;
      alive: boolean;
      created_at_ms: number;
      tag?: string;
    }
  | {
      id: string;
      kind: "kernel";
      name: string;
      grid: number[];
      block: number[];
      duration_us: number;
      stream: number;
      started_at_ms: number;
    }
  | {
      id: string;
      kind: "memcpy";
      direction: "HtoD" | "DtoH" | "DtoD";
      size_bytes: number;
      duration_us: number;
      stream: number;
      started_at_ms: number;
    };

export type ProfilerEdge = { source: string; target: string; type: string };

export type ProfilerSnapshot = {
  nodes: ProfilerNode[];
  edges: ProfilerEdge[];
};

export const profilerSnapshot: ProfilerSnapshot = makeFakeProfilerSnapshot();

function makeFakeProfilerSnapshot(): ProfilerSnapshot {
  const nodes: ProfilerNode[] = [];

  // 8 CPU objects
  for (let i = 1; i <= 8; i++) {
    nodes.push({
      id: `cpu:obj:${i}`,
      kind: "cpu_object",
      class: i === 8 ? "torch.nn.Module" : i % 2 === 0 ? "torch.Tensor" : "numpy.ndarray",
      size_bytes: i === 8 ? 65536 : i % 2 === 0 ? 4_194_304 : 4096,
      ref_count: Math.max(1, (i % 4) + 1),
      gc_gen: i % 3,
      alive: true,
      created_at_ms: 12000 + i * 3,
      tag: i === 8 ? "model" : "cpu",
    });
  }

  // 6 GPU allocations
  for (let i = 1; i <= 6; i++) {
    nodes.push({
      id: `gpu:mem:${i}`,
      kind: "gpu_allocation",
      device: 0,
      alloc: "cudaMalloc",
      size_bytes: i === 4 ? 8_388_608 : i % 2 === 0 ? 4_194_304 : 2_097_152,
      stream: i % 2 === 0 ? 12 : 7,
      alive: true,
      created_at_ms: 12020 + i * 2,
      tag: "gpu",
    });
  }

  // 4 kernels
  const kernelNames = ["matmul_fwd", "relu_fwd", "matmul_bwd", "optimizer_step"];
  for (let i = 1; i <= 4; i++) {
    nodes.push({
      id: `gpu:kernel:${i}`,
      kind: "kernel",
      name: kernelNames[i - 1],
      grid: [256, 1, 1],
      block: [128, 1, 1],
      duration_us: 400 + i * 500,
      stream: i === 4 ? 12 : 7,
      started_at_ms: 12040 + i * 3,
    });
  }

  // 2 memcpy events
  for (let i = 1; i <= 2; i++) {
    nodes.push({
      id: `xfer:${i}`,
      kind: "memcpy",
      direction: "HtoD",
      size_bytes: 4_194_304,
      duration_us: 200 + i * 40,
      stream: 7,
      started_at_ms: 12010 + i * 2,
    });
  }

  // 20 nodes total: 8 + 6 + 4 + 2
  const edges: ProfilerEdge[] = [
    // CPU refs
    { source: "cpu:obj:8", target: "cpu:obj:2", type: "references" },
    { source: "cpu:obj:8", target: "cpu:obj:4", type: "references" },
    { source: "cpu:obj:4", target: "cpu:obj:1", type: "references" },
    { source: "cpu:obj:4", target: "cpu:obj:3", type: "references" },

    // CPU -> memcpy -> GPU
    { source: "cpu:obj:1", target: "xfer:1", type: "transfers_to" },
    { source: "xfer:1", target: "gpu:mem:1", type: "transfers_to" },
    { source: "cpu:obj:2", target: "xfer:2", type: "transfers_to" },
    { source: "xfer:2", target: "gpu:mem:2", type: "transfers_to" },

    // backing
    { source: "cpu:obj:1", target: "gpu:mem:1", type: "backs" },
    { source: "cpu:obj:2", target: "gpu:mem:2", type: "backs" },

    // kernels
    { source: "gpu:mem:1", target: "gpu:kernel:1", type: "reads_from" },
    { source: "gpu:mem:2", target: "gpu:kernel:1", type: "reads_from" },
    { source: "gpu:kernel:1", target: "gpu:mem:4", type: "writes_to" },

    { source: "gpu:mem:4", target: "gpu:kernel:2", type: "reads_from" },
    { source: "gpu:kernel:2", target: "gpu:mem:1", type: "writes_to" },

    { source: "gpu:mem:1", target: "gpu:kernel:3", type: "reads_from" },
    { source: "gpu:kernel:3", target: "gpu:mem:6", type: "writes_to" },

    { source: "gpu:mem:6", target: "gpu:kernel:4", type: "reads_from" },
    { source: "gpu:kernel:4", target: "gpu:mem:2", type: "writes_to" },
  ];

  return { nodes, edges };
}

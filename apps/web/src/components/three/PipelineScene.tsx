import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ──────────────────────────────────────────────────────────── */

export type NodeType = "browser" | "api" | "queue" | "worker" | "analysis" | "ai" | "output";

export type PipelineNode = {
  id: NodeType;
  label: string;
  sublabel: string;
  position: [number, number, number];
  color: string;
  glowColor: string;
  size: number;
};

export type ConnectionDef = {
  from: NodeType;
  to: NodeType;
  color: string;
};

/* ─── Constants ───────────────────────────────────────────────────────── */

export const PIPELINE_NODES: PipelineNode[] = [
  {
    id: "browser",
    label: "Browser",
    sublabel: "User Request",
    position: [-9, 0, 0],
    color: "#67e8f9",
    glowColor: "#22d3ee",
    size: 1.0,
  },
  {
    id: "api",
    label: "API Server",
    sublabel: "Express + BullMQ",
    position: [-5.5, 0, 0],
    color: "#818cf8",
    glowColor: "#a78bfa",
    size: 1.0,
  },
  {
    id: "queue",
    label: "Redis Queue",
    sublabel: "BullMQ",
    position: [-2, 0, 0],
    color: "#f97316",
    glowColor: "#fb923c",
    size: 0.9,
  },
  {
    id: "worker",
    label: "Worker",
    sublabel: "Node.js Job Processor",
    position: [1.5, 0, 0],
    color: "#fb7185",
    glowColor: "#fb7185",
    size: 1.0,
  },
  {
    id: "analysis",
    label: "Static Analysis",
    sublabel: "Tree-sitter",
    position: [4.5, 0, 0],
    color: "#facc15",
    glowColor: "#fde047",
    size: 0.9,
  },
  {
    id: "ai",
    label: "AI Service",
    sublabel: "FastAPI + Groq",
    position: [7.5, 0, 0],
    color: "#a78bfa",
    glowColor: "#c084fc",
    size: 1.0,
  },
  {
    id: "output",
    label: "Output",
    sublabel: "Findings · Summary · Graph",
    position: [10.5, 0, 0],
    color: "#34d399",
    glowColor: "#6ee7b7",
    size: 1.0,
  },
];

export const PIPELINE_CONNECTIONS: ConnectionDef[] = [
  { from: "browser", to: "api", color: "#67e8f9" },
  { from: "api", to: "queue", color: "#818cf8" },
  { from: "queue", to: "worker", color: "#f97316" },
  { from: "worker", to: "analysis", color: "#fb7185" },
  { from: "worker", to: "ai", color: "#fb7185" },
  { from: "analysis", to: "ai", color: "#facc15" },
  { from: "ai", to: "output", color: "#a78bfa" },
];

/* ─── Animated data packet ────────────────────────────────────────────── */

interface DataPacketProps {
  from: [number, number, number];
  to: [number, number, number];
  delay: number;
  color: string;
  speed?: number;
}

function DataPacket({ from, to, delay, color, speed = 0.15 }: DataPacketProps): React.JSX.Element {
  const ref = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
    if (!ref.current) return;
    const t = (timeRef.current * speed + delay) % 1;
    const x = from[0] + (to[0] - from[0]) * t;
    const y =
      from[1] +
      (to[1] - from[1]) * t +
      Math.sin(t * Math.PI) * 0.25;
    const z = from[2] + (to[2] - from[2]) * t;
    ref.current.position.set(x, y, z);
    const scale = 0.3 + 0.15 * Math.sin(t * Math.PI);
    ref.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={ref} position={from}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}

/* ─── Pipeline node 3D object ──────────────────────────────────────── */

interface PipelineNodeMeshProps {
  node: PipelineNode;
  active: boolean;
}

function PipelineNodeMesh({ node, active }: PipelineNodeMeshProps): React.JSX.Element {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.4 + node.position[0];
      outerRef.current.rotation.z = t * 0.15;
    }
    if (innerRef.current) {
      innerRef.current.rotation.x = t * 0.3;
      innerRef.current.rotation.y = t * 0.5;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.5 + node.position[0]) * 0.2;
      ringRef.current.rotation.z = t * 0.2;
    }
  });

  const color = active ? node.glowColor : node.color;

  return (
    <group position={node.position}>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[node.size * 0.55, 0]} />
        <meshBasicMaterial color={color} opacity={active ? 0.95 : 0.6} transparent wireframe />
      </mesh>
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[node.size * 0.9, 1]} />
        <meshBasicMaterial color={color} opacity={active ? 0.18 : 0.08} transparent wireframe />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[node.size * 1.1, 0.03, 8, 64]} />
        <meshBasicMaterial color={color} opacity={active ? 0.6 : 0.2} transparent />
      </mesh>
      {active && (
        <mesh>
          <sphereGeometry args={[node.size * 1.4, 16, 16]} />
          <meshBasicMaterial color={node.glowColor} opacity={0.04} transparent />
        </mesh>
      )}
    </group>
  );
}

/* ─── Connection line ──────────────────────────────────────────────────── */

interface ConnectionMeshProps {
  from: PipelineNode;
  to: PipelineNode;
  color: string;
}

function ConnectionMesh({ from, to, color }: ConnectionMeshProps): React.JSX.Element {
  const lineRef = useRef<THREE.LineSegments>(null);

  const points = useMemo(() => {
    const steps = 30;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.position[0] + (to.position[0] - from.position[0]) * t;
      const y =
        from.position[1] +
        (to.position[1] - from.position[1]) * t +
        Math.sin(t * Math.PI) * 0.3;
      const z = from.position[2] + (to.position[2] - from.position[2]) * t;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, [from.position, to.position]);

  const linePositions = useMemo(() => {
    const pos: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      pos.push(a.x, a.y, a.z);
      pos.push(b.x, b.y, b.z);
    }
    return new Float32Array(pos);
  }, [points]);

  const packets = [0.05, 0.3, 0.55, 0.8];

  return (
    <group>
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
            count={linePositions.length / 3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} opacity={0.25} transparent />
      </lineSegments>
      {packets.map((delay, i) => (
        <DataPacket
          key={i}
          from={from.position}
          to={to.position}
          delay={delay}
          color={color}
        />
      ))}
    </group>
  );
}

/* ─── Main scene ────────────────────────────────────────────────────── */

export type PipelineSceneProps = {
  activeStage?: NodeType | null;
};

export function PipelineScene({ activeStage = null }: PipelineSceneProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.08;
    }
  });

  const getActive = (nodeId: NodeType): boolean => {
    if (!activeStage) return true;
    const order: NodeType[] = [
      "browser",
      "api",
      "queue",
      "worker",
      "analysis",
      "ai",
      "output",
    ];
    return order.indexOf(nodeId) <= order.indexOf(activeStage);
  };

  return (
    <>
      <color attach="background" args={["#050208"]} />
      <ambientLight intensity={0.15} />
      <pointLight color="#22d3ee" intensity={0.8} position={[-8, 6, 8]} />
      <pointLight color="#fb7185" intensity={0.6} position={[8, 4, 8]} />
      <Stars count={800} depth={40} fade speed={0.3} factor={3} radius={60} saturation={0} />

      <group ref={groupRef}>
        {PIPELINE_NODES.map((node) => (
          <PipelineNodeMesh key={node.id} node={node} active={getActive(node.id)} />
        ))}

        {PIPELINE_CONNECTIONS.map((conn) => {
          const fromNode = PIPELINE_NODES.find((n) => n.id === conn.from)!;
          const toNode = PIPELINE_NODES.find((n) => n.id === conn.to)!;
          return (
            <ConnectionMesh
              key={`${conn.from}-${conn.to}`}
              from={fromNode}
              to={toNode}
              color={conn.color}
            />
          );
        })}
      </group>
    </>
  );
}

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type ParticleNetworkProps = {
  count?: number;
  spread?: number;
  connectionDistance?: number;
};

export function ParticleNetwork({
  count = 120,
  spread = 14,
  connectionDistance = 3.2,
}: ParticleNetworkProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  const { positions, linePositions } = useMemo(() => {
    const nodes: THREE.Vector3[] = [];

    for (let index = 0; index < count; index += 1) {
      nodes.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread * 0.7,
          (Math.random() - 0.5) * spread,
        ),
      );
    }

    const pointPositions = new Float32Array(count * 3);
    nodes.forEach((node, index) => {
      pointPositions[index * 3] = node.x;
      pointPositions[index * 3 + 1] = node.y;
      pointPositions[index * 3 + 2] = node.z;
    });

    const segments: number[] = [];
    for (let left = 0; left < nodes.length; left += 1) {
      const leftNode = nodes[left];
      if (!leftNode) {
        continue;
      }

      for (let right = left + 1; right < nodes.length; right += 1) {
        const rightNode = nodes[right];
        if (!rightNode) {
          continue;
        }

        if (leftNode.distanceTo(rightNode) < connectionDistance) {
          segments.push(
            leftNode.x,
            leftNode.y,
            leftNode.z,
            rightNode.x,
            rightNode.y,
            rightNode.z,
          );
        }
      }
    }

    return {
      positions: pointPositions,
      linePositions: new Float32Array(segments),
    };
  }, [count, spread, connectionDistance]);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y = state.clock.elapsedTime * 0.04;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.08;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        </bufferGeometry>
        <pointsMaterial
          color="#67e8f9"
          opacity={0.85}
          size={0.06}
          sizeAttenuation
          transparent
        />
      </points>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
            count={linePositions.length / 3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#22d3ee" opacity={0.18} transparent />
      </lineSegments>
    </group>
  );
}

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

export function WireframeCore(): React.JSX.Element {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (innerRef.current) {
      innerRef.current.rotation.x = elapsed * 0.18;
      innerRef.current.rotation.y = elapsed * 0.24;
    }
    if (outerRef.current) {
      outerRef.current.rotation.x = -elapsed * 0.1;
      outerRef.current.rotation.z = elapsed * 0.14;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(elapsed * 0.3) * 0.15;
      ringRef.current.rotation.z = elapsed * 0.08;
    }
  });

  return (
    <group>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[2.2, 1]} />
        <meshBasicMaterial color="#22d3ee" opacity={0.45} transparent wireframe />
      </mesh>
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[3.4, 0]} />
        <meshBasicMaterial color="#a78bfa" opacity={0.12} transparent wireframe />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[4.2, 0.02, 12, 120]} />
        <meshBasicMaterial color="#67e8f9" opacity={0.35} transparent />
      </mesh>
    </group>
  );
}

import { Float, Stars } from "@react-three/drei";
import { ParticleNetwork } from "./ParticleNetwork.js";
import { WireframeCore } from "./WireframeCore.js";

type SceneContentProps = {
  variant?: "hero" | "ambient";
};

export function SceneContent({ variant = "hero" }: SceneContentProps): React.JSX.Element {
  const isHero = variant === "hero";

  return (
    <>
      <color attach="background" args={["#050208"]} />
      <fog attach="fog" args={["#050208", 12, 45]} />
      <ambientLight intensity={0.12} />
      <pointLight color="#fb7185" intensity={isHero ? 1.1 : 0.55} position={[8, 6, 10]} />
      <pointLight color="#22d3ee" intensity={isHero ? 0.7 : 0.3} position={[-10, -4, -6]} />
      <Stars
        count={isHero ? 4500 : 1800}
        depth={60}
        fade
        factor={4}
        radius={isHero ? 90 : 70}
        saturation={0}
        speed={0.35}
      />
      <ParticleNetwork
        count={isHero ? 140 : 60}
        connectionDistance={isHero ? 3.4 : 3}
        spread={isHero ? 16 : 12}
      />
      {isHero ? (
        <Float floatIntensity={0.8} rotationIntensity={0.35} speed={1.4}>
          <WireframeCore />
        </Float>
      ) : null}
    </>
  );
}

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  MathUtils,
  Shape,
  TubeGeometry,
  Vector3,
  type Group,
} from "three";
import type { RefObject } from "react";

const charcoal = "#28282e";
const silver = "#b3b1ba";
const coral = "#c5543f";

function ChairModel() {
  const back = useMemo(
    () => new TubeGeometry(new CatmullRomCurve3([
      new Vector3(-0.58, 1.42, 0.28),
      new Vector3(-0.66, 1.43, -0.18),
      new Vector3(-0.38, 1.46, -0.52),
      new Vector3(0.38, 1.46, -0.52),
      new Vector3(0.66, 1.43, -0.18),
      new Vector3(0.58, 1.42, 0.28),
    ]), 64, 0.22, 12, false),
    [],
  );

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.79, -0.08]} scale={[1.05, 0.23, 0.85]}>
        <sphereGeometry args={[0.58, 32, 20]} />
        <meshStandardMaterial color={charcoal} roughness={0.96} />
      </mesh>
      <mesh castShadow geometry={back}>
        <meshStandardMaterial color={charcoal} roughness={0.94} />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} castShadow position={[x, 0.68, 0.28]}>
          <cylinderGeometry args={[0.17, 0.19, 1.36, 20]} />
          <meshStandardMaterial color={charcoal} roughness={0.96} />
        </mesh>
      ))}
      <mesh castShadow position={[-0.43, 0.39, -0.4]}>
        <cylinderGeometry args={[0.13, 0.15, 0.78, 18]} />
        <meshStandardMaterial color={charcoal} roughness={0.96} />
      </mesh>
      <mesh castShadow position={[0.43, 0.39, -0.4]}>
        <cylinderGeometry args={[0.13, 0.15, 0.78, 18]} />
        <meshStandardMaterial color={charcoal} roughness={0.96} />
      </mesh>
    </group>
  );
}

function TableModel() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.42, 0.5, 1.1, 40]} />
        <meshStandardMaterial color="#34343a" roughness={0.78} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.13, 0]}>
        <cylinderGeometry args={[1.12, 1.1, 0.12, 64]} />
        <meshStandardMaterial color="#303036" roughness={0.74} metalness={0.1} />
      </mesh>
      <mesh castShadow position={[-0.54, 1.21, 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.012, 6, 32]} />
        <meshStandardMaterial color="#d6d3d8" metalness={0.35} roughness={0.38} />
      </mesh>
      <mesh castShadow position={[0.58, 1.21, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.012, 6, 32]} />
        <meshStandardMaterial color="#d6d3d8" metalness={0.35} roughness={0.38} />
      </mesh>
    </group>
  );
}

function PhotoBoothModel() {
  const shell = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.43, 0);
    shape.lineTo(0.43, 0);
    shape.lineTo(0.43, 1.54);
    shape.absarc(0, 1.54, 0.43, 0, Math.PI, false);
    shape.lineTo(-0.43, 0);
    return new ExtrudeGeometry(shape, {
      depth: 0.38,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 4,
      curveSegments: 24,
    });
  }, []);

  return (
    <group>
      <mesh castShadow geometry={shell} position={[0, 0.03, -0.19]}>
        <meshStandardMaterial color={silver} roughness={0.44} metalness={0.42} />
      </mesh>
      <mesh position={[0, 1.02, 0.245]}>
        <boxGeometry args={[0.55, 1.22, 0.032]} />
        <meshStandardMaterial color="#35353c" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.56, 0.28]}>
        <torusGeometry args={[0.14, 0.035, 12, 40]} />
        <meshStandardMaterial color="#f6f3ef" emissive="#e7e1da" emissiveIntensity={0.65} />
      </mesh>
      <mesh position={[0, 1.15, 0.275]}>
        <boxGeometry args={[0.27, 0.3, 0.012]} />
        <meshStandardMaterial color="#151518" roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.5, 0.275]}>
        <boxGeometry args={[0.2, 0.12, 0.018]} />
        <meshStandardMaterial color="#1d1d21" roughness={0.5} />
      </mesh>
    </group>
  );
}

function FloralModel() {
  const stems = useMemo(() => Array.from({ length: 38 }, (_, index) => {
    const angle = index * 2.39996;
    const reach = 0.6 + (index % 5) * 0.12;
    const tip = new Vector3(
      Math.cos(angle) * reach,
      Math.sin(index * 1.17) * 0.35 + 0.12,
      Math.sin(angle) * reach * 0.42,
    );
    const curve = new CatmullRomCurve3([
      new Vector3(0, -0.22, 0),
      new Vector3(tip.x * 0.42, tip.y * 0.3, tip.z * 0.42),
      tip,
    ]);
    return { geometry: new TubeGeometry(curve, 12, 0.008, 5, false), tip, flower: index % 3 === 0 };
  }), []);

  return (
    <group>
      <mesh position={[0, -0.32, 0]} castShadow>
        <sphereGeometry args={[0.22, 20, 14]} />
        <meshStandardMaterial color="#6a696e" roughness={0.75} />
      </mesh>
      <mesh position={[0.02, 0.05, -0.16]} rotation={[0.25, 0.4, 0]}>
        <torusGeometry args={[0.79, 0.022, 8, 72]} />
        <meshStandardMaterial color="#a8a5ac" metalness={0.72} roughness={0.32} />
      </mesh>
      {stems.map(({ geometry, tip, flower }, index) => (
        <group key={index}>
          <mesh geometry={geometry}>
            <meshStandardMaterial color="#737177" roughness={0.77} />
          </mesh>
          {flower ? (
            <group position={tip.toArray()}>
              {Array.from({ length: 5 }, (_, petal) => {
                const angle = (petal / 5) * Math.PI * 2;
                return (
                  <mesh key={petal} position={[Math.cos(angle) * 0.08, Math.sin(angle) * 0.08, 0]} rotation={[0, 0, angle - Math.PI / 2]}>
                    <sphereGeometry args={[0.075, 10, 8]} />
                    <meshStandardMaterial color={index % 2 ? "#ebe8e9" : "#f7f5f2"} roughness={0.89} />
                  </mesh>
                );
              })}
              <mesh position={[0, 0, 0.07]}>
                <sphereGeometry args={[0.035, 10, 8]} />
                <meshStandardMaterial color={coral} roughness={0.72} />
              </mesh>
            </group>
          ) : (
            <mesh position={tip.toArray()}>
              <sphereGeometry args={[index % 4 ? 0.036 : 0.05, 10, 8]} />
              <meshStandardMaterial color={index % 4 ? coral : "#e6e4e7"} roughness={0.78} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

export function EventModels({
  scrollProgress,
  dragRotation,
  reducedMotion,
}: {
  scrollProgress: RefObject<number>;
  dragRotation: RefObject<number>;
  reducedMotion: RefObject<boolean>;
}) {
  const whole = useRef<Group>(null);
  const chair = useRef<Group>(null);
  const flowers = useRef<Group>(null);
  const booth = useRef<Group>(null);
  const { size } = useThree();

  useFrame((state, delta) => {
    const p = reducedMotion.current ? 0 : scrollProgress.current;
    const t = state.clock.elapsedTime;
    if (whole.current) {
      whole.current.rotation.y = MathUtils.damp(whole.current.rotation.y, dragRotation.current + p * 0.48, 3.8, delta);
      const scale = size.width < 700 ? 0.61 : size.width < 1050 ? 0.82 : 1;
      whole.current.scale.setScalar(MathUtils.damp(whole.current.scale.x, scale, 4, delta));
    }
    if (chair.current) {
      chair.current.position.x = MathUtils.damp(chair.current.position.x, -1.12 + p * 0.18, 2.4, delta);
      chair.current.rotation.y = MathUtils.damp(chair.current.rotation.y, -0.16 + p * 0.3, 2.4, delta);
    }
    if (flowers.current) {
      flowers.current.position.y = MathUtils.damp(flowers.current.position.y, 2.42 - p * 0.68 + (reducedMotion.current ? 0 : Math.sin(t * 0.7) * 0.045), 2.2, delta);
      flowers.current.rotation.z = MathUtils.damp(flowers.current.rotation.z, -0.16 + p * 0.26, 2.2, delta);
    }
    if (booth.current) {
      booth.current.position.x = MathUtils.damp(booth.current.position.x, 2.12 + p * 0.3, 2, delta);
      booth.current.rotation.y = MathUtils.damp(booth.current.rotation.y, -0.32 - p * 0.15, 2, delta);
    }
  });

  return (
    <group ref={whole} position={[0, -0.46, 0]}>
      <mesh receiveShadow position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.18, 72]} />
        <meshStandardMaterial color="#e3e1eb" roughness={1} />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.2, 0.006, 4, 120]} />
        <meshBasicMaterial color="#a9a8b7" transparent opacity={0.67} />
      </mesh>
      <group ref={chair} position={[-1.12, 0, 0.74]} rotation={[0, -0.16, 0]}><ChairModel /></group>
      <group position={[0.46, 0, -0.57]}><TableModel /></group>
      <group ref={flowers} position={[0.43, 2.42, -0.54]} rotation={[0, 0, -0.16]}><FloralModel /></group>
      <group ref={booth} position={[2.12, 0, -1.18]} rotation={[0, -0.32, 0]} scale={0.88}><PhotoBoothModel /></group>
    </group>
  );
}

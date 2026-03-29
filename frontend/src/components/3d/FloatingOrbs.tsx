"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function AnimatedOrb({ position, color, speed }: { position: [number, number, number]; color: string; speed: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime() * speed;
    meshRef.current.position.y = position[1] + Math.sin(time) * 0.5;
    meshRef.current.rotation.x = time * 0.3;
    meshRef.current.rotation.y = time * 0.2;
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]} position={position}>
      <MeshDistortMaterial
        color={color}
        attach="material"
        distort={0.3}
        speed={2}
        roughness={0.2}
        metalness={0.8}
      />
    </Sphere>
  );
}

export default function FloatingOrbs() {
  return (
    <div className="absolute inset-0 -z-10 opacity-30">
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#3b82f6" />

        <AnimatedOrb position={[-3, 0, -2]} color="#3b82f6" speed={0.5} />
        <AnimatedOrb position={[3, 1, -1]} color="#8b5cf6" speed={0.7} />
        <AnimatedOrb position={[0, -2, -3]} color="#06b6d4" speed={0.6} />
      </Canvas>
    </div>
  );
}

/**
 * ConstructionLoader.jsx — 3D Construction Site Loading Animation
 *
 * A reusable Three.js loading component showing an animated construction scene
 * with a crane, monitor/screen being built, workers, and construction elements.
 * Inspired by the "website under construction" illustration style.
 */
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/* ─────────────────── Helper: Rounded Box Geometry ─────────────────── */
function RoundedBox({ width = 1, height = 1, depth = 0.1, radius = 0.05, color = '#ffffff', ...props }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const w = width / 2 - radius;
    const h = height / 2 - radius;
    s.moveTo(-w, -height / 2);
    s.lineTo(w, -height / 2);
    s.quadraticCurveTo(width / 2, -height / 2, width / 2, -h);
    s.lineTo(width / 2, h);
    s.quadraticCurveTo(width / 2, height / 2, w, height / 2);
    s.lineTo(-w, height / 2);
    s.quadraticCurveTo(-width / 2, height / 2, -width / 2, h);
    s.lineTo(-width / 2, -h);
    s.quadraticCurveTo(-width / 2, -height / 2, -w, -height / 2);
    return s;
  }, [width, height, radius]);

  const geometry = useMemo(() => {
    const extrudeSettings = { depth, bevelEnabled: false };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [shape, depth]);

  return (
    <mesh geometry={geometry} {...props}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/* ─────────────────── Monitor / Screen ─────────────────── */
function Monitor() {
  return (
    <group position={[-0.3, 1.8, 0]}>
      {/* Screen bezel */}
      <RoundedBox width={3.8} height={2.4} depth={0.12} radius={0.08} color="#2c3e6b" position={[0, 0, 0]} />
      {/* Screen inner */}
      <RoundedBox width={3.4} height={2.0} depth={0.02} radius={0.04} color="#e8edf5" position={[0, 0, 0.08]} />

      {/* Browser toolbar */}
      <mesh position={[0, 0.75, 0.1]}>
        <boxGeometry args={[3.3, 0.18, 0.01]} />
        <meshStandardMaterial color="#d1d8e8" />
      </mesh>

      {/* URL bar */}
      <mesh position={[0.3, 0.75, 0.11]}>
        <boxGeometry args={[2.2, 0.1, 0.01]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Content placeholder lines */}
      <ContentLines />

      {/* Stand */}
      <mesh position={[0, -1.45, 0]}>
        <boxGeometry args={[0.4, 0.5, 0.12]} />
        <meshStandardMaterial color="#3a4a78" />
      </mesh>
      {/* Base */}
      <mesh position={[0, -1.75, 0]}>
        <boxGeometry args={[1.4, 0.1, 0.5]} />
        <meshStandardMaterial color="#3a4a78" />
      </mesh>
    </group>
  );
}

/* ─────────────────── Content Lines (Animated) ─────────────────── */
function ContentLines() {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const children = groupRef.current.children;
      children.forEach((child, i) => {
        const t = clock.getElapsedTime();
        child.material.opacity = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.8 + i * 0.5));
      });
    }
  });

  const lines = [
    { w: 2.8, y: 0.4, color: '#c5cfe0' },
    { w: 2.0, y: 0.18, color: '#c5cfe0' },
    { w: 2.5, y: -0.04, color: '#c5cfe0' },
    { w: 1.5, y: -0.26, color: '#c5cfe0' },
    { w: 2.2, y: -0.48, color: '#c5cfe0' },
  ];

  return (
    <group ref={groupRef} position={[0, 0, 0.1]}>
      {lines.map((l, i) => (
        <mesh key={i} position={[-(3.3 - l.w) / 2 * 0.3, l.y, 0]}>
          <boxGeometry args={[l.w, 0.1, 0.01]} />
          <meshStandardMaterial color={l.color} transparent />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────────── Crane ─────────────────── */
function Crane() {
  const hookRef = useRef();
  const panelRef = useRef();
  const cableRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Swing the hook & panel
    const swing = Math.sin(t * 0.6) * 0.3;
    if (hookRef.current) {
      hookRef.current.position.x = 1.2 + swing;
      hookRef.current.position.y = 2.2 + Math.sin(t * 0.4) * 0.15;
    }
    if (panelRef.current) {
      panelRef.current.position.x = 1.2 + swing;
      panelRef.current.position.y = 1.6 + Math.sin(t * 0.4) * 0.15;
      panelRef.current.rotation.z = Math.sin(t * 0.3) * 0.05;
    }
    if (cableRef.current) {
      const hookY = 2.2 + Math.sin(t * 0.4) * 0.15;
      cableRef.current.position.x = 1.2 + swing;
      cableRef.current.position.y = (4.2 + hookY) / 2;
      cableRef.current.scale.y = (4.2 - hookY);
    }
  });

  return (
    <group position={[2.2, 0, -0.5]}>
      {/* Vertical tower */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[0.15, 5, 0.15]} />
        <meshStandardMaterial color="#5a7dbd" />
      </mesh>
      {/* Cross braces */}
      {[1, 2, 3, 4].map(i => (
        <mesh key={i} position={[0, i * 1.0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.05, 0.28, 0.05]} />
          <meshStandardMaterial color="#4a6aa8" />
        </mesh>
      ))}

      {/* Horizontal boom */}
      <mesh position={[-1.0, 4.2, 0]}>
        <boxGeometry args={[3.5, 0.12, 0.12]} />
        <meshStandardMaterial color="#5a7dbd" />
      </mesh>

      {/* Counter weight */}
      <mesh position={[0.6, 4.0, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.3]} />
        <meshStandardMaterial color="#e8765a" />
      </mesh>

      {/* Cable */}
      <mesh ref={cableRef} position={[-1.0, 3.2, 0]}>
        <boxGeometry args={[0.02, 1, 0.02]} />
        <meshStandardMaterial color="#7a8fb5" />
      </mesh>

      {/* Hook */}
      <mesh ref={hookRef} position={[-1.0, 2.2, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.08]} />
        <meshStandardMaterial color="#ffc107" />
      </mesh>

      {/* Panel being carried */}
      <group ref={panelRef} position={[-1.0, 1.6, 0]}>
        <mesh>
          <boxGeometry args={[0.9, 0.5, 0.06]} />
          <meshStandardMaterial color="#ef8a7a" opacity={0.9} transparent />
        </mesh>
      </group>
    </group>
  );
}

/* ─────────────────── Worker (Simplified Character) ─────────────────── */
function Worker({ position = [0, 0, 0], color = '#f5a623', armAction = 'wave' }) {
  const armRef = useRef();
  const bodyRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (armRef.current) {
      if (armAction === 'wave') {
        armRef.current.rotation.z = Math.sin(t * 2) * 0.4 + 0.6;
      } else if (armAction === 'hammer') {
        armRef.current.rotation.z = Math.sin(t * 3) * 0.5 - 0.3;
      } else {
        armRef.current.rotation.z = Math.sin(t * 1.5) * 0.2;
      }
    }
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 1.2) * 0.02;
    }
  });

  return (
    <group position={position}>
      <group ref={bodyRef}>
        {/* Head */}
        <mesh position={[0, 0.65, 0]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#fcd5b4" />
        </mesh>
        {/* Hard hat */}
        <mesh position={[0, 0.76, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.08, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Hat brim */}
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.03, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Body */}
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[0.24, 0.36, 0.16]} />
          <meshStandardMaterial color="#5a7cbd" />
        </mesh>
        {/* Legs */}
        <mesh position={[-0.06, 0.05, 0]}>
          <boxGeometry args={[0.09, 0.22, 0.1]} />
          <meshStandardMaterial color="#4a6088" />
        </mesh>
        <mesh position={[0.06, 0.05, 0]}>
          <boxGeometry args={[0.09, 0.22, 0.1]} />
          <meshStandardMaterial color="#4a6088" />
        </mesh>
        {/* Left arm (static) */}
        <mesh position={[-0.18, 0.35, 0]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.08, 0.28, 0.08]} />
          <meshStandardMaterial color="#5a7cbd" />
        </mesh>
        {/* Right arm (animated) */}
        <group ref={armRef} position={[0.18, 0.42, 0]}>
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[0.08, 0.28, 0.08]} />
            <meshStandardMaterial color="#5a7cbd" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ─────────────────── Forklift / Vehicle ─────────────────── */
function Forklift() {
  const ref = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      // Gentle back and forth
      ref.current.position.x = -3.2 + Math.sin(t * 0.3) * 0.4;
    }
  });

  return (
    <group ref={ref} position={[-3.2, 0.15, 0.5]}>
      {/* Body */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.7, 0.35, 0.4]} />
        <meshStandardMaterial color="#f5c542" />
      </mesh>
      {/* Cab */}
      <mesh position={[-0.1, 0.5, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.35]} />
        <meshStandardMaterial color="#f5c542" />
      </mesh>
      {/* Fork arms */}
      <mesh position={[0.4, 0.15, 0.1]}>
        <boxGeometry args={[0.4, 0.04, 0.06]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      <mesh position={[0.4, 0.15, -0.1]}>
        <boxGeometry args={[0.4, 0.04, 0.06]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Fork mast */}
      <mesh position={[0.28, 0.35, 0]}>
        <boxGeometry args={[0.05, 0.5, 0.3]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Wheels */}
      {[[-0.2, 0, 0.22], [-0.2, 0, -0.22], [0.2, 0, 0.22], [0.2, 0, -0.22]].map((pos, i) => (
        <mesh key={i} position={pos} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
      {/* Boxes on fork */}
      <mesh position={[0.5, 0.35, 0]}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#d4956a" />
      </mesh>
    </group>
  );
}

/* ─────────────────── Boxes / Crates ─────────────────── */
function Crates() {
  return (
    <group position={[0.8, 0, 1]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.3, 0.25, 0.3]} />
        <meshStandardMaterial color="#d4956a" />
      </mesh>
      <mesh position={[0.25, 0.1, 0.1]}>
        <boxGeometry args={[0.22, 0.2, 0.22]} />
        <meshStandardMaterial color="#c4855a" />
      </mesh>
      <mesh position={[0.1, 0.32, 0.05]}>
        <boxGeometry args={[0.2, 0.18, 0.2]} />
        <meshStandardMaterial color="#e5a57a" />
      </mesh>
      {/* Code symbol on crate  */}
      <mesh position={[-0.3, 0.18, 0]}>
        <boxGeometry args={[0.25, 0.35, 0.25]} />
        <meshStandardMaterial color="#ef8a7a" />
      </mesh>
    </group>
  );
}

/* ─────────────────── Ground ─────────────────── */
function Ground() {
  return (
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[14, 8]} />
      <meshStandardMaterial color="#e8edf5" />
    </mesh>
  );
}

/* ─────────────────── Loading Text ─────────────────── */
function LoadingDots({ text = "Loading" }) {
  return null; // Text is rendered as HTML overlay instead
}

/* ─────────────────── 3D Scene Composition ─────────────────── */
function ConstructionScene() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} color="#b0c4de" />

      <Ground />
      <Monitor />
      <Crane />

      {/* Workers */}
      <Worker position={[-1.5, 0, 0.8]} color="#f5a623" armAction="wave" />
      <Worker position={[1.0, 0, 1.2]} color="#e8765a" armAction="hammer" />
      <Worker position={[3.0, 0, 0.6]} color="#f5c542" armAction="idle" />

      <Forklift />
      <Crates />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.8}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 4}
      />
    </>
  );
}

/* ─────────────────── Main Exported Component ─────────────────── */
export const ConstructionLoader = ({
  text = "Setting things up",
  subtext = "Please wait while we prepare everything...",
  minHeight = "440px",
}) => {
  return (
    <div
      className="relative flex flex-col items-center justify-center w-full select-none"
      style={{ minHeight }}
    >
      {/* 3D Canvas */}
      <div className="w-full" style={{ height: '320px', maxWidth: '560px' }}>
        <Canvas
          camera={{ position: [0, 3, 7], fov: 40 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <ConstructionScene />
        </Canvas>
      </div>

      {/* Text overlay below the 3D scene */}
      <div className="flex flex-col items-center mt-4 gap-1.5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-bold text-gray-800 tracking-tight">{text}</h2>
          <span className="inline-flex gap-[3px] mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6d00a8] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#880d83] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#a31562] animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
        <p className="text-sm text-gray-500 font-normal">{subtext}</p>
      </div>
    </div>
  );
};

export default ConstructionLoader;

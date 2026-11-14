'use client'

import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

export type ViewPreset = 'isometri' | 'depan' | 'belakang' | 'samping'

const VIEWS: Record<ViewPreset, [number, number, number]> = {
  isometri: [4.6, 3.8, 4.6],
  depan: [0, 1.2, 6.4],
  belakang: [0, 1.2, -6.4],
  samping: [6.4, 1.2, 0],
}

const CASE = '#26313f'
const CASE_EDGE = '#33404f'
const ACCENT = '#2f6df5'
const METAL = '#9aa4b2'
const PCB = '#0e3b2e'
const DARK = '#0b1119'

const TOP_FACE = 0.585

function CameraRig({ preset }: { preset: ViewPreset }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as { update?: () => void } | null
  const goal = useRef(new THREE.Vector3(...VIEWS.isometri))
  const moving = useRef(false)

  useEffect(() => {
    goal.current.set(...VIEWS[preset])
    moving.current = true
  }, [preset])

  useFrame(() => {
    if (!moving.current) return
    camera.position.lerp(goal.current, 0.14)
    controls?.update?.()
    if (camera.position.distanceTo(goal.current) < 0.04) moving.current = false
  })

  return null
}

function FitCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const size = useThree((s) => s.size)

  useEffect(() => {
    camera.zoom = Math.min(size.width / 4.2, size.height / 3.4)
    camera.updateProjectionMatrix()
  }, [camera, size])

  return null
}

function Device({ exploded, showTop }: { exploded: boolean; showTop: boolean }) {
  const top = useRef<THREE.Group>(null)
  const bottom = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.05))
    if (top.current) {
      const goal = exploded ? 0.72 : 0
      top.current.position.y += (goal - top.current.position.y) * k
    }
    if (bottom.current) {
      const goal = exploded ? -0.22 : 0
      bottom.current.position.y += (goal - bottom.current.position.y) * k
    }
  })

  return (
    <group>
      <group ref={bottom}>
        <RoundedBox
          args={[2.5, 0.6, 1.7]}
          radius={0.07}
          smoothness={4}
          position={[0, -0.24, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={CASE} roughness={0.45} metalness={0.25} />
        </RoundedBox>

        <mesh position={[0, -0.5, -0.9]} castShadow>
          <boxGeometry args={[1.5, 0.1, 0.16]} />
          <meshStandardMaterial color={CASE_EDGE} roughness={0.5} metalness={0.3} />
        </mesh>
        {[-0.62, 0.62].map((x) => (
          <mesh key={x} position={[x, -0.42, -0.9]} castShadow>
            <boxGeometry args={[0.1, 0.2, 0.16]} />
            <meshStandardMaterial color={CASE_EDGE} roughness={0.5} metalness={0.3} />
          </mesh>
        ))}

        <mesh position={[0.55, -0.15, 0.86]}>
          <boxGeometry args={[0.24, 0.09, 0.03]} />
          <meshStandardMaterial color={METAL} metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0.95, -0.15, 0.86]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.03, 24]} />
          <meshStandardMaterial color={METAL} metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[-0.95, -0.13, 0.86]}>
          <boxGeometry args={[0.34, 0.16, 0.05]} />
          <meshStandardMaterial color="#1f6f4a" roughness={0.6} />
        </mesh>
      </group>

      <group>
        <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 0.05, 1.45]} />
          <meshStandardMaterial color={PCB} roughness={0.75} metalness={0.1} />
        </mesh>
        <mesh position={[-0.62, 0.1, 0.12]} castShadow>
          <boxGeometry args={[0.62, 0.1, 0.46]} />
          <meshStandardMaterial color="#1f2937" roughness={0.45} metalness={0.5} />
        </mesh>
        <mesh position={[0.35, 0.08, 0.3]} castShadow>
          <boxGeometry args={[0.26, 0.07, 0.26]} />
          <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.75, 0.08, -0.2]} castShadow>
          <boxGeometry args={[0.2, 0.06, 0.2]} />
          <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.95, 0.1, 0.42]} castShadow>
          <boxGeometry args={[0.2, 0.14, 0.16]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.6} />
        </mesh>
        <mesh position={[-0.95, 0.12, -0.5]} castShadow>
          <boxGeometry args={[0.34, 0.18, 0.2]} />
          <meshStandardMaterial color="#1f6f4a" roughness={0.6} />
        </mesh>
      </group>

      <group ref={top} visible={showTop}>
        <RoundedBox
          args={[2.5, 0.5, 1.7]}
          radius={0.07}
          smoothness={4}
          position={[0, 0.33, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={CASE} roughness={0.42} metalness={0.28} />
        </RoundedBox>

        <mesh position={[0, 0.075, 0]}>
          <boxGeometry args={[2.52, 0.025, 1.72]} />
          <meshStandardMaterial color={DARK} roughness={0.9} />
        </mesh>

        <mesh position={[0, 0.12, 0.855]}>
          <boxGeometry args={[2.3, 0.035, 0.02]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.35} />
        </mesh>

        <mesh position={[0.1, TOP_FACE - 0.002, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.24, 0.74]} />
          <meshStandardMaterial color={DARK} roughness={0.6} />
        </mesh>
        <mesh position={[0.1, TOP_FACE, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.12, 0.64]} />
          <meshStandardMaterial
            color="#0a1730"
            emissive={ACCENT}
            emissiveIntensity={0.55}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>

        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-0.5 + i * 0.3, TOP_FACE, -0.58]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.22, 0.035]} />
            <meshStandardMaterial color={DARK} roughness={0.9} />
          </mesh>
        ))}

        <mesh position={[0.88, TOP_FACE, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.34, 0.05]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.1} />
        </mesh>

        <mesh position={[-1.02, TOP_FACE, -0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.16, 0.16]} />
          <meshStandardMaterial color={ACCENT} roughness={0.4} />
        </mesh>

        {[-1.02, -0.87].map((x) => (
          <mesh key={x} position={[x, TOP_FACE, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.05, 20]} />
            <meshStandardMaterial color={DARK} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

type DeviceSceneProps = {
  preset: ViewPreset
  exploded: boolean
  autoRotate: boolean
  showTop: boolean
}

export function DeviceScene({ preset, exploded, autoRotate, showTop }: DeviceSceneProps) {
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: VIEWS.isometri, zoom: 100, near: 0.1, far: 100 }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[5, 7, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.7} />
      <directionalLight position={[0, 3, -6]} intensity={0.55} />

      <Suspense fallback={null}>
        <Device exploded={exploded} showTop={showTop} />
        <ContactShadows
          position={[0, -0.72, 0]}
          opacity={0.32}
          scale={7}
          blur={2.6}
          far={2.2}
          color="#0b1a33"
        />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        autoRotate={autoRotate}
        autoRotateSpeed={1.1}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.35}
        maxPolarAngle={1.45}
      />
      <CameraRig preset={preset} />
      <FitCamera />
    </Canvas>
  )
}

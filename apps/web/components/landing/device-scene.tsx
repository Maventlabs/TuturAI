'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei/core/ContactShadows'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useGLTF } from '@react-three/drei/core/Gltf'
import * as THREE from 'three'

export type ViewPreset = 'isometri' | 'depan' | 'belakang' | 'samping'

const VIEWS: Record<ViewPreset, [number, number, number]> = {
  isometri: [4.6, 3.8, -4.6],
  depan: [0, 1.2, -6.4],
  belakang: [0, 1.2, 6.4],
  samping: [6.4, 1.2, 0],
}

function CameraRig({ preset }: { preset: ViewPreset }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { update?: () => void } | null
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
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const size = useThree((state) => state.size)

  useEffect(() => {
    camera.zoom = Math.min(size.width / 4.2, size.height / 3.4)
    camera.updateProjectionMatrix()
  }, [camera, size])

  return null
}

type ModelPart = {
  mesh: THREE.Mesh
  center: THREE.Vector3
  originalPosition: THREE.Vector3
}

function Device({ exploded, showTop }: { exploded: boolean; showTop: boolean }) {
  const { scene } = useGLTF('/tuturai-device.glb')
  const model = useMemo(() => scene.clone(true), [scene])
  const modelBounds = useMemo(() => {
    model.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(model)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const parts: ModelPart[] = []

    model.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return
      const mesh = object as THREE.Mesh
      const partBounds = new THREE.Box3().setFromObject(mesh)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parts.push({
        mesh,
        center: partBounds.getCenter(new THREE.Vector3()),
        originalPosition: mesh.position.clone(),
      })
    })

    return {
      center,
      size,
      scale: 3.6 / Math.max(size.x, size.y, size.z),
      parts,
      splitHeight: center.y,
      largestDimension: Math.max(size.x, size.y, size.z),
    }
  }, [model])

  useEffect(() => {
    model.updateWorldMatrix(true, true)
    modelBounds.parts.forEach(({ mesh, center, originalPosition }) => {
      mesh.position.copy(originalPosition)
      mesh.visible = showTop || center.y <= modelBounds.splitHeight

      if (exploded) {
        const direction = center.clone().sub(modelBounds.center)
        if (direction.lengthSq() < 0.001) direction.set(0, 1, 0)
        direction.normalize()

        const parent = mesh.parent
        const distance = modelBounds.largestDimension * 0.16
        const originalCenter = parent ? parent.worldToLocal(center.clone()) : center.clone()
        const separatedCenter = parent
          ? parent.worldToLocal(center.clone().addScaledVector(direction, distance))
          : center.clone().addScaledVector(direction, distance)
        mesh.position.add(separatedCenter.sub(originalCenter))
      }
    })
    model.updateWorldMatrix(true, true)
  }, [exploded, model, modelBounds, showTop])

  return (
    <group
      scale={modelBounds.scale}
      position={[
        -modelBounds.center.x * modelBounds.scale,
        -modelBounds.center.y * modelBounds.scale,
        -modelBounds.center.z * modelBounds.scale,
      ]}
    >
      <primitive object={model} />
    </group>
  )
}

export type DeviceSceneProps = {
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
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: VIEWS.isometri, zoom: 100, near: 0.1, far: 100 }}
      aria-label="Model 3D konsol TuturAI. Gunakan kontrol sudut pandang atau geser ke segala arah untuk memutar penuh 360 derajat."
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[5, 7, -4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 3, 4]} intensity={0.7} />
      <directionalLight position={[0, 3, 6]} intensity={0.55} />

      <Suspense fallback={null}>
        <Device exploded={exploded} showTop={showTop} />
        <ContactShadows
          position={[0, -0.7, 0]}
          opacity={0.24}
          scale={5.5}
          blur={2.4}
          far={2.2}
          color="#1d1d1f"
        />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableRotate
        autoRotate={autoRotate}
        autoRotateSpeed={1.1}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.001}
        maxPolarAngle={Math.PI - 0.001}
      />
      <CameraRig preset={preset} />
      <FitCamera />
    </Canvas>
  )
}

useGLTF.preload('/tuturai-device.glb')

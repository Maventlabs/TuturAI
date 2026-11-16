'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei/core/ContactShadows'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { useGLTF } from '@react-three/drei/core/Gltf'
import * as THREE from 'three'

export type ViewPreset = 'isometri' | 'depan' | 'belakang' | 'samping'

const MODEL_URL = '/tuturai-device.glb'
const MODEL_SIZE = 3.6
const CAMERA_FOV = 32
const FIT_PADDING = 1.06
/** The console face points at -Z; this flips the model so the screen reads upright. */
const MODEL_ROLL = Math.PI

/** Camera sits on this side of the model. */
const VIEW_DIRECTIONS: Record<ViewPreset, [number, number, number]> = {
  isometri: [0.66, 0.42, -0.62],
  depan: [0, 0.05, -1],
  belakang: [0, 0.05, 1],
  samping: [1, 0.05, 0],
}

type Part = {
  mesh: THREE.Mesh
  base: THREE.Vector3
  target: THREE.Vector3
  direction: THREE.Vector3
}

function computeFit(box: THREE.Box3, direction: THREE.Vector3, fovDeg: number, aspect: number) {
  const center = box.getCenter(new THREE.Vector3())
  const forward = direction.clone().normalize()
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward)
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0)
  right.normalize()
  const up = new THREE.Vector3().crossVectors(forward, right).normalize()

  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)
  const tanH = tanV * aspect

  let distance = 0
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const rel = new THREE.Vector3(x, y, z).sub(center)
        const depth = rel.dot(forward)
        distance = Math.max(
          distance,
          depth + Math.abs(rel.dot(right)) / tanH,
          depth + Math.abs(rel.dot(up)) / tanV,
        )
      }
    }
  }

  return { center, distance: distance * FIT_PADDING }
}

function CameraRig({ preset, box }: { preset: ViewPreset; box: THREE.Box3 }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const size = useThree((state) => state.size)
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  const goal = useRef(new THREE.Vector3())
  const target = useRef(new THREE.Vector3())
  const moving = useRef(false)
  const settled = useRef(false)

  useEffect(() => {
    const direction = new THREE.Vector3(...VIEW_DIRECTIONS[preset])
    const fit = computeFit(box, direction, CAMERA_FOV, size.width / size.height)
    goal.current.copy(fit.center).addScaledVector(direction.normalize(), fit.distance)
    target.current.copy(fit.center)

    if (!settled.current) {
      settled.current = true
      camera.position.copy(goal.current)
      if (controls) {
        controls.target.copy(target.current)
        controls.update()
      }
      return
    }

    moving.current = true
  }, [preset, box, size.width, size.height, camera, controls])

  useFrame(() => {
    if (!moving.current) return
    camera.position.lerp(goal.current, 0.24)
    if (controls) {
      controls.target.lerp(target.current, 0.24)
      controls.update()
    }
    if (camera.position.distanceTo(goal.current) < 0.01) {
      camera.position.copy(goal.current)
      moving.current = false
    }
  })

  return null
}

function DeviceModel({
  exploded,
  showTop,
  onBounds,
}: {
  exploded: boolean
  showTop: boolean
  onBounds: (box: THREE.Box3) => void
}) {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  const { parts, worldBox, scale, center, depth, body } = useMemo(() => {
    model.updateMatrixWorld(true)
    const rawBox = new THREE.Box3().setFromObject(model)
    const rawCenter = rawBox.getCenter(new THREE.Vector3())
    const rawSize = rawBox.getSize(new THREE.Vector3())
    const fitScale = MODEL_SIZE / Math.max(rawSize.x, rawSize.y, rawSize.z)

    const meshes: THREE.Mesh[] = []
    model.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      meshes.push(mesh)
    })

    // Box3.setFromObject walks children, so a parent node reports the bounds of
    // the whole device. Measuring each mesh's own geometry keeps the shell and
    // the internals distinguishable.
    const ownBox = (mesh: THREE.Mesh) => {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
    }

    const list: Part[] = meshes.map((mesh) => {
      const partCenter = ownBox(mesh).getCenter(new THREE.Vector3())
      const direction = partCenter.sub(rawCenter)
      if (direction.lengthSq() < 1e-8) direction.set(0, 1, 0)
      direction.normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), MODEL_ROLL)
      return {
        mesh,
        base: mesh.position.clone(),
        target: mesh.position.clone(),
        direction,
      }
    })

    let body: THREE.Mesh | null = null
    let bodyVolume = 0
    for (const mesh of meshes) {
      const size = ownBox(mesh).getSize(new THREE.Vector3())
      const volume = size.x * size.y * size.z
      if (volume > bodyVolume) {
        bodyVolume = volume
        body = mesh
      }
    }

    if (body) {
      const cloned = Array.isArray(body.material)
        ? body.material.map((material) => material.clone())
        : [body.material.clone()]
      body.material = Array.isArray(body.material) ? cloned : cloned[0]
    }

    const worldSize = rawSize.clone().multiplyScalar(fitScale)
    const box = new THREE.Box3(
      worldSize.clone().multiplyScalar(-0.5),
      worldSize.clone().multiplyScalar(0.5),
    )

    return {
      parts: list,
      worldBox: box,
      scale: fitScale,
      center: rawCenter,
      depth: worldSize.z,
      body,
    }
  }, [model])

  useEffect(() => {
    onBounds(worldBox)
  }, [onBounds, worldBox])

  // The casing is a single shell mesh that also parents every internal part, so
  // `visible = false` would hide the whole device. Toggling the material keeps
  // the children rendering while the shell itself drops out.
  useEffect(() => {
    if (!body) return
    const materials = Array.isArray(body.material) ? body.material : [body.material]
    // three.js materials are mutable scene objects, not React state.
    // eslint-disable-next-line react-hooks/immutability
    for (const material of materials) material.visible = showTop
  }, [body, showTop])

  useEffect(() => {
    model.updateWorldMatrix(true, true)
    const spread = depth * 0.9

    for (const part of parts) {
      const parent = part.mesh.parent
      if (!parent) continue

      const worldOffset = exploded
        ? part.direction.clone().multiplyScalar(spread * 0.45)
        : new THREE.Vector3()

      const position = new THREE.Vector3()
      const quaternion = new THREE.Quaternion()
      const parentScale = new THREE.Vector3()
      parent.matrixWorld.decompose(position, quaternion, parentScale)
      const localOffset = worldOffset.applyQuaternion(quaternion.invert()).divide(parentScale)
      part.target.copy(part.base).add(localOffset)
    }
  }, [exploded, model, parts, center, depth])

  useFrame((_, delta) => {
    const t = 1 - Math.pow(0.0001, Math.min(delta, 0.1))
    for (const part of parts) {
      part.mesh.position.lerp(part.target, t)
    }
  })

  return (
    <group rotation={[0, 0, MODEL_ROLL]}>
      <group scale={scale} position={[-center.x * scale, -center.y * scale, -center.z * scale]}>
        <primitive object={model} />
      </group>
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
  const [bounds, setBounds] = useState<THREE.Box3 | null>(null)
  // Exploded parts travel past the assembled silhouette, so the framing box has
  // to grow with them or the front view clips the shell.
  const fitBox = useMemo(
    () => (bounds ? bounds.clone().expandByScalar(exploded ? 0.42 : 0.06) : null),
    [bounds, exploded],
  )

  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0.6, 8], fov: CAMERA_FOV, near: 0.1, far: 100 }}
      aria-label="Model 3D konsol TuturAI. Geser untuk memutar penuh 360 derajat."
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 7, -4]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 3, 4]} intensity={0.6} />
      <directionalLight position={[0, 3, 6]} intensity={0.4} />

      <Suspense fallback={null}>
        <DeviceModel exploded={exploded} showTop={showTop} onBounds={setBounds} />
        <ContactShadows
          position={[0, -1.24, 0]}
          opacity={0.22}
          scale={7}
          blur={2.6}
          far={2.4}
          color="#1d1d1f"
        />
      </Suspense>

      {fitBox ? <CameraRig preset={preset} box={fitBox} /> : null}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableRotate
        rotateSpeed={0.85}
        autoRotate={autoRotate}
        autoRotateSpeed={1.2}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.001}
        maxPolarAngle={Math.PI - 0.001}
      />
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL)

'use client'

import { sceneRegistry, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'

function tagNodesForExport() {
  const nodes = useScene.getState().nodes
  for (const id of Object.keys(nodes)) {
    const node = nodes[id as keyof typeof nodes]
    const obj = sceneRegistry.nodes.get(id as Parameters<typeof sceneRegistry.nodes.get>[0])
    if (!(node && obj)) continue
    obj.name = `${node.type}_${id}`
  }
}

export function ExportManager() {
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const setExportScene = useViewer((state) => state.setExportScene)

  useEffect(() => {
    const exportFn = async (format: 'glb' | 'stl' | 'obj' | 'png' = 'glb') => {
      const date = new Date().toISOString().split('T')[0]

      if (format === 'png') {
        const canvas = gl.domElement as HTMLCanvasElement
        const renderer = gl as unknown as {
          renderAsync?: (s: typeof scene, c: typeof camera) => Promise<void>
          render: (s: typeof scene, c: typeof camera) => void
        }
        if (typeof renderer.renderAsync === 'function') {
          await renderer.renderAsync(scene, camera)
        } else {
          renderer.render(scene, camera)
        }
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null'))),
            'image/png',
          )
        })
        downloadBlob(blob, `viewport_${date}.png`)
        return
      }

      // Find the scene renderer group by name
      const sceneGroup = scene.getObjectByName('scene-renderer')
      if (!sceneGroup) {
        console.error('scene-renderer group not found')
        return
      }

      tagNodesForExport()

      if (format === 'stl') {
        const exporter = new STLExporter()
        const result = exporter.parse(sceneGroup, { binary: true })
        const blob = new Blob([result], { type: 'model/stl' })
        downloadBlob(blob, `model_${date}.stl`)
        return
      }

      if (format === 'obj') {
        const exporter = new OBJExporter()
        const result = exporter.parse(sceneGroup)
        const blob = new Blob([result], { type: 'model/obj' })
        downloadBlob(blob, `model_${date}.obj`)
        return
      }

      // Default: GLB export (existing behavior)
      const exporter = new GLTFExporter()

      return new Promise<void>((resolve, reject) => {
        exporter.parse(
          sceneGroup,
          (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' })
            downloadBlob(blob, `model_${date}.glb`)
            resolve()
          },
          (error) => {
            console.error('Export error:', error)
            reject(error)
          },
          { binary: true },
        )
      })
    }

    setExportScene(exportFn)

    return () => {
      setExportScene(null)
    }
  }, [scene, gl, camera, setExportScene])

  return null
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

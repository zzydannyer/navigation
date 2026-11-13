// Original procedural model: no third-party model or texture licensing required.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((data) => { this.result = data; this.onloadend?.() }) }
  readAsDataURL(blob) { blob.arrayBuffer().then((data) => { this.result = `data:${blob.type};base64,${Buffer.from(data).toString('base64')}`; this.onloadend?.() }) }
}
const ship = new THREE.Group()
const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
const hullShape = new THREE.Shape()
hullShape.moveTo(-9, 32)
hullShape.lineTo(-10, -25)
hullShape.lineTo(0, -48)
hullShape.lineTo(10, -25)
hullShape.lineTo(9, 32)
hullShape.closePath()
const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 8, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 1, steps: 1 }), material('#193c59'))
hull.rotation.x = -Math.PI / 2
ship.add(hull)
function box(w, h, d, x, y, z, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color))
  mesh.position.set(x, y, z)
  ship.add(mesh)
}
box(16, 1, 58, 0, 9, 2, '#c7bd9b')
box(13, 10, 15, 0, 14, 20, '#f0f3ed')
box(14, 4, 10, 0, 21, 20, '#ffffff')
box(14.2, 2, 8, 0, 21, 20, '#174e69')
box(3, 9, 4, 0, 25, 25, '#ec7844')
box(0.6, 12, 0.6, 0, 28, 18, '#dfe6e9')
for (let i = 0; i < 3; i++) {
  box(6, 5, 10, -3.4, 12, -17 + i * 11, ['#ec7844', '#287b89', '#d7b24b'][i])
  box(6, 5, 10, 3.4, 12, -17 + i * 11, ['#287b89', '#d7b24b', '#ec7844'][i])
}
const output = fileURLToPath(new URL('../public/models/', import.meta.url))
mkdirSync(output, { recursive: true })
const binary = await new GLTFExporter().parseAsync(ship, { binary: true })
writeFileSync(`${output}/demo-ship.glb`, Buffer.from(binary))
console.log(`Generated demo-ship.glb (${binary.byteLength} bytes)`)

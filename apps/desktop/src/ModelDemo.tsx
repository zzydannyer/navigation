import { useEffect, useRef, useState } from 'react'
import { ErrorEvent, Map, MercatorCoordinate, NavigationControl, type CustomLayerInterface, type GeoJSONSource } from 'maplibre-gl'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import './ModelDemo.css'
import { stressData } from './stressData'

const origin: [number, number] = [122.2, 30.7]

export default function ModelDemo({ map }: { map: Map }) {
  const mapRef = useRef<Map>(map)
  const control = useRef({ playing: true, heading: 30, size: 1, model: null as THREE.Object3D | null })
  const [status, setStatus] = useState('正在初始化 WebGL…')
  const [playing, setPlaying] = useState(true)
  const [heading, setHeading] = useState(30)
  const [size, setSize] = useState(1)
  const [fps, setFps] = useState(0)
  const [filename, setFilename] = useState('内置演示船.glb')
  const [count, setCount] = useState(10000)
  const [dynamic, setDynamic] = useState(false)
  const [dataMs, setDataMs] = useState(0)
  const [collapsed, setCollapsed] = useState(true)
  const [span, setSpan] = useState(1)
  const [gpuMode, setGpuMode] = useState(false)
  const [showModel, setShowModel] = useState(true)
  const gpu = useRef({ count: 0, dynamic: false, span: 1 })
  const [mapMessage, setMapMessage] = useState('底图加载中')
  const stress = useRef({ count: 10000, dynamic: false })
  const loadRef = useRef<(data: ArrayBuffer, name: string) => void>(() => {})

  useEffect(() => {
    const state = control.current
    mapRef.current = map
    let alive = true
    let renderer: THREE.WebGLRenderer | undefined
    let frameCount = 0
    let sampleTime = performance.now()
    let lastTime = sampleTime
    let phase = 0
    let failed = false
    const scene = new THREE.Scene()
    const camera = new THREE.Camera()
    const ship = new THREE.Group()
    const cloudGeometry = new THREE.BufferGeometry()
    const cloudMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, moving: { value: 0 }, extent: { value: 1 } },
      vertexShader: `uniform float time; uniform float moving; uniform float extent; attribute float seed;
        varying vec3 tint; void main(){ vec3 p=position*extent;
        p.x+=sin(time*0.4+seed)*40.0*moving; p.z+=cos(time*0.3+seed)*40.0*moving;
        tint=vec3(0.15+0.7*fract(seed),0.6,0.8); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); gl_PointSize=2.0; }`,
      fragmentShader: `varying vec3 tint; void main(){if(distance(gl_PointCoord,vec2(0.5))>0.5)discard;gl_FragColor=vec4(tint,0.85);}`,
      transparent: true, depthWrite: false,
    })
    const cloud = new THREE.Points(cloudGeometry, cloudMaterial)
    cloud.frustumCulled = false
    scene.add(cloud)
    let cloudCount = -1
    let simulationTime = 0
    scene.add(ship, new THREE.HemisphereLight(0xffffff, 0x335577, 2.5))
    const sun = new THREE.DirectionalLight(0xffffff, 3)
    sun.position.set(100, 200, 100)
    scene.add(sun)
    const disposeModel = (object: THREE.Object3D) => {
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        child.geometry.dispose()
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose()
          material.dispose()
        }
      })
    }
    const loader = new GLTFLoader()
    loadRef.current = (data, name) => {
      loader.parse(data, '', (gltf) => {
        if (!alive) { disposeModel(gltf.scene); return }
        if (control.current.model) {
          ship.remove(control.current.model)
          disposeModel(control.current.model)
        }
        const model = gltf.scene
        const bounds = new THREE.Box3().setFromObject(model)
        const dimensions = bounds.getSize(new THREE.Vector3())
        const length = Math.max(dimensions.x, dimensions.y, dimensions.z)
        if (!Number.isFinite(length) || length <= 0) { disposeModel(model); setStatus('模型尺寸无效'); return }
        const center = bounds.getCenter(new THREE.Vector3())
        model.position.set(-center.x, -bounds.min.y, -center.z)
        const normalized = new THREE.Group()
        normalized.add(model)
        normalized.scale.setScalar(100 / length)
        ship.add(normalized)
        control.current.model = normalized
        setFilename(name)
        setStatus('3D 模型已加载 · 可拖动、缩放、双指倾斜')
      }, () => { if (alive) setStatus('模型加载失败，请使用自包含、未压缩的 GLB 文件') })
    }
    const navigation = new NavigationControl({ visualizePitch: true })
    map.addControl(navigation, 'top-right')
    const layer: CustomLayerInterface = {
      id: 'demo-ship', type: 'custom', renderingMode: '3d',
      onAdd(_map, gl) {
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
        renderer.autoClear = false
        fetch('/models/demo-ship.glb').then((response) => {
          if (!response.ok) throw new Error('model')
          return response.arrayBuffer()
        }).then((data) => { if (alive) loadRef.current(data, '内置演示船.glb') })
          .catch(() => { if (alive) setStatus('内置模型读取失败，请尝试导入 GLB') })
      },
      render(_gl, args) {
        if (!renderer || failed) return
        const now = performance.now()
        const dt = Math.min((now - lastTime) / 1000, 0.1)
        lastTime = now
        if (gpu.current.dynamic) simulationTime += dt
        if (cloudCount !== gpu.current.count) {
          const start = performance.now()
          cloudCount = gpu.current.count
          const positions = new Float32Array(cloudCount * 3)
          const seeds = new Float32Array(cloudCount)
          for (let i = 0; i < cloudCount; i++) {
            positions[i * 3] = (((i * 0.61803398875) % 1) - 0.5) * 1000
            positions[i * 3 + 1] = 2
            positions[i * 3 + 2] = (((i * 0.41421356237) % 1) - 0.5) * 1000
            seeds[i] = i * 0.01
          }
          cloudGeometry.dispose()
          cloudGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
          cloudGeometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1))
          cloudGeometry.setDrawRange(0, cloudCount)
          setDataMs(Math.round(performance.now() - start))
        }
        cloudMaterial.uniforms.time.value = simulationTime
        cloudMaterial.uniforms.moving.value = 1
        cloudMaterial.uniforms.extent.value = gpu.current.span
        cloud.visible = cloudCount > 0
        if (control.current.playing) phase += dt * 0.12
        const lng = origin[0] + Math.sin(phase) * 0.001
        const lat = origin[1] + (Math.cos(phase) - 1) * 0.0005
        const coord = MercatorCoordinate.fromLngLat(origin, 0)
        const shipCoord = MercatorCoordinate.fromLngLat([lng, lat], 0)
        const scale = coord.meterInMercatorCoordinateUnits()
        ship.position.set((shipCoord.x - coord.x) / scale, 0, (shipCoord.y - coord.y) / scale)
        ship.rotation.y = -control.current.heading * Math.PI / 180
        ship.scale.setScalar(control.current.size)
        const transform = new THREE.Matrix4().makeTranslation(coord.x, coord.y, coord.z)
          .scale(new THREE.Vector3(scale, -scale, scale))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(transform)
        try {
          renderer.resetState()
          renderer.render(scene, camera)
          renderer.resetState()
        } catch {
          failed = true
          setStatus('GPU 渲染失败，请检查设备 WebGL2 支持或刷新重试')
        }
        frameCount++
        if (now - sampleTime > 1000) {
          setFps(Math.round(frameCount * 1000 / (now - sampleTime)))
          sampleTime = now
          frameCount = 0
        }
        if (!document.hidden && !failed) map.triggerRepaint()
      },
      onRemove() { cloudGeometry.dispose(); cloudMaterial.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh) disposeModel(object) }); renderer?.dispose() },
    }
    const onLoad = () => {
      map.addSource('stress-points', { type: 'geojson', data: stressData(stress.current.count), maxzoom: 18 })
      map.addLayer({ id: 'stress-points', type: 'circle', source: 'stress-points', paint: {
        'circle-radius': 2.5, 'circle-opacity': 0.8,
        'circle-color': ['match', ['get', 'group'], 0, '#07b6a4', 1, '#f59e0b', 2, '#e65171', '#438bff'],
      } })
      map.addLayer(layer)
      map.addSource('demo-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Array.from({ length: 65 }, (_, i) => [origin[0] + Math.sin(i / 64 * Math.PI * 2) * 0.001, origin[1] + (Math.cos(i / 64 * Math.PI * 2) - 1) * 0.0005]) } } })
      map.addLayer({ id: 'demo-route', type: 'line', source: 'demo-route', paint: { 'line-color': '#ef823e', 'line-width': 3, 'line-dasharray': [2, 2] } }, 'demo-ship')
      if (alive) setMapMessage('底图已加载')
    }
    const onError = (event: ErrorEvent) => { console.error('Demo map:', event.error.message); if (alive) setMapMessage(`地图错误：${event.error.message.slice(0, 130)}`) }
    map.on('error', onError)
    if (map.loaded()) onLoad()
    else map.on('load', onLoad)
    let tick = 0
    const updateStress = () => {
      const source = map.getSource('stress-points') as GeoJSONSource | undefined
      if (!source) return
      const start = performance.now()
      source.setData(stressData(stress.current.count, tick))
      setDataMs(Math.round(performance.now() - start))
    }
    const interval = window.setInterval(() => {
      if (document.hidden || !stress.current.dynamic) return
      tick++
      updateStress()
    }, 1000)
    const refreshStress = () => { tick = 0; updateStress() }
    window.addEventListener('demo-stress-change', refreshStress)
    const resume = () => { lastTime = performance.now(); map.triggerRepaint() }
    document.addEventListener('visibilitychange', resume)
    return () => {
      alive = false
      window.clearInterval(interval)
      window.removeEventListener('demo-stress-change', refreshStress)
      document.removeEventListener('visibilitychange', resume)
      map.off('load', onLoad)
      map.off('error', onError)
      map.removeControl(navigation)
      for (const id of ['demo-route', 'stress-points', 'demo-ship']) if (map.getLayer(id)) map.removeLayer(id)
      for (const id of ['demo-route', 'stress-points']) if (map.getSource(id)) map.removeSource(id)
      state.model = null
    }
  }, [map])

  return <div className="model-demo">
    <header className="demo-header"><div><small>TAURI / MAPLIBRE GL JS</small><h1>海上 3D 验证</h1></div><span className="demo-fps">{fps} FPS</span></header>
    <section className={`demo-panel${collapsed ? ' collapsed' : ''}`}>
      <button className="panel-toggle" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? `展开面板 · ${count.toLocaleString()}点 · ${fps} FPS` : '收起面板'}</button>
      <div className="panel-body" hidden={collapsed}>
      <strong>{filename}</strong><p role="status">{status}</p>
      <p>{mapMessage}</p>
      <details open><summary>要素压力测试 · {count.toLocaleString()} 点</summary>
        <label><input type="checkbox" checked={gpuMode} onChange={(event) => {
          const enabled = event.target.checked; setGpuMode(enabled)
          const next = enabled ? count : Math.min(count, 100000)
          setCount(next); gpu.current.count = enabled ? next : 0; stress.current.count = enabled ? 0 : next
          window.dispatchEvent(new Event('demo-stress-change'))
        }} /> GPU 百万动态点模式</label>
        <div className="demo-actions">{[0, 10000, 100000, 300000, 500000, 1000000].map((amount) => <button key={amount} aria-pressed={count === amount} onClick={() => {
          const useGpu = gpuMode || amount > 100000
          setGpuMode(useGpu); gpu.current.count = useGpu ? amount : 0
          stress.current.count = useGpu ? 0 : amount; setCount(amount); window.dispatchEvent(new Event('demo-stress-change'))
        }}>{amount === 0 ? '清空' : `${amount / 10000}万`}</button>)}</div>
        <label><input type="checkbox" checked={dynamic} onChange={(event) => { stress.current.dynamic = event.target.checked; gpu.current.dynamic = event.target.checked; setDynamic(event.target.checked) }} /> {gpuMode ? 'GPU 每帧移动全部点' : '每秒更新全部 GeoJSON 点'}</label>
        <label>GPU 分布范围 <select value={span} onChange={(event) => { const value = Number(event.target.value); setSpan(value); gpu.current.span = value; mapRef.current?.easeTo({ center: origin, zoom: 15.5 - Math.log2(value), pitch: 45 }) }}>{[1, 10, 100, 1000].map((value) => <option key={value} value={value}>{value} × {value} km</option>)}</select></label>
        <button onClick={() => mapRef.current?.easeTo({ center: origin, zoom: 15.5 - Math.log2(span), pitch: 45 })}>查看全部测试范围</button>
        <p>{gpuMode ? 'GPU 粒子渲染：逐点独立运动，不测试 GeoJSON 更新/查询。' : 'GeoJSON 圆点渲染：测试数据更新和瓦片处理。'} 非 3D 船模。生成/提交 {dataMs} ms，不含 GPU 完成时间；FPS 为持续绘制帧率。</p>
      </details>
      <div className="demo-actions">
        <button onClick={() => { const visible = !showModel; setShowModel(visible); mapRef.current?.setLayoutProperty('demo-ship', 'visibility', visible ? 'visible' : 'none') }}>{showModel ? '关闭3D层看底图' : '显示3D层'}</button>
        <button onClick={() => mapRef.current?.easeTo({ center: origin, zoom: 9, pitch: 0, bearing: 0 })}>查看区域底图</button>
        <button onClick={() => { control.current.playing = !playing; setPlaying(!playing) }}>{playing ? '暂停航行' : '继续航行'}</button>
        <button onClick={() => mapRef.current?.easeTo({ center: origin, zoom: 15.5, pitch: 60, bearing: -25 })}>回到船位</button>
        <label className="demo-import">导入 GLB<input type="file" accept=".glb" onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          if (file.size > 20 * 1024 * 1024) { setStatus('Demo 限制模型文件不超过 20 MB'); return }
          setStatus('正在解析模型…')
          try { loadRef.current(await file.arrayBuffer(), file.name) } catch { setStatus('无法读取文件') }
          event.target.value = ''
        }} /></label>
      </div>
      <label className="demo-slider">航向 {heading}°<input type="range" min="0" max="360" value={heading} onChange={(event) => { const value = Number(event.target.value); control.current.heading = value; setHeading(value) }} /></label>
      <label className="demo-slider">模型大小 {size.toFixed(1)}×<input type="range" min="0.3" max="3" step="0.1" value={size} onChange={(event) => { const value = Number(event.target.value); control.current.size = value; setSize(value) }} /></label>
      <small>模拟航行 · 与定位页同一张底图，非 ENC 海图 · GLB 默认最长边归一到 100 米</small>
      </div>
    </section>
  </div>
}

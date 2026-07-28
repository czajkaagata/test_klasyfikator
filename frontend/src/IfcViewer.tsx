import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import * as THREE from 'three'

const WASM_VERSION = '0.0.77'
const FLAG_STYLE = 'flagged'
const DIM_STYLE = 'dimmed'

export interface IfcViewerHandle {
  loadFile: (file: File) => Promise<void>
  highlightGuid: (guid: string | null) => Promise<void>
}

interface Ready {
  components: OBC.Components
  world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>
  fragments: OBC.FragmentsManager
  ifcLoader: OBC.IfcLoader
  highlighter: OBF.Highlighter
}

async function setupViewer(host: HTMLDivElement): Promise<Ready> {
  const components = new OBC.Components()
  const worlds = components.get(OBC.Worlds)
  const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>()

  world.scene = new OBC.SimpleScene(components)
  world.renderer = new OBC.SimpleRenderer(components, host)
  world.camera = new OBC.OrthoPerspectiveCamera(components)

  components.init()
  world.scene.setup({ backgroundColor: new THREE.Color('#f6f6f5') })

  const fragments = components.get(OBC.FragmentsManager)
  const workerUrl = await OBC.FragmentsManager.getWorker()
  fragments.init(workerUrl)
  fragments.list.onItemSet.add(({ value: model }) => {
    model.useCamera(world.camera.three)
    world.scene.three.add(model.object)
    fragments.core.update(true)
    world.camera.fitToItems()
    // tiles stream in progressively; re-fit once the first geometry has
    // actually rendered so the initial view isn't framed on an empty box.
    setTimeout(() => world.camera.fitToItems(), 400)
  })

  const ifcLoader = components.get(OBC.IfcLoader)
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: { path: `https://unpkg.com/web-ifc@${WASM_VERSION}/`, absolute: true },
  })

  const highlighter = components.get(OBF.Highlighter)
  highlighter.setup({ world })
  highlighter.styles.set(FLAG_STYLE, {
    color: new THREE.Color('#c62828'),
    opacity: 1,
    transparent: false,
    renderedFaces: 0,
  })
  // Dims everything except the current selection while keeping each
  // element's own material color (preserveOriginalMaterial + _explicitProps
  // limit the override to just opacity/transparent).
  highlighter.styles.set(DIM_STYLE, {
    color: new THREE.Color('#ffffff'),
    renderedFaces: 0,
    opacity: 0.12,
    transparent: true,
    preserveOriginalMaterial: true,
    _explicitProps: ['opacity', 'transparent'],
  })

  return { components, world, fragments, ifcLoader, highlighter }
}

async function allItemsMap(fragments: OBC.FragmentsManager): Promise<OBC.ModelIdMap> {
  const map: OBC.ModelIdMap = {}
  for (const [, model] of fragments.list) {
    map[model.modelId] = new Set(await model.getLocalIds())
  }
  return map
}

const IfcViewer = forwardRef<IfcViewerHandle, { onError?: (msg: string) => void }>(
  function IfcViewer({ onError }, ref) {
    const hostRef = useRef<HTMLDivElement>(null)
    // Resolves once the engine is ready; loadFile/highlightGuid await it instead of
    // racing the async OBC/OBF setup (wasm + worker init) triggered by the effect below.
    const readyPromiseRef = useRef<Promise<Ready> | null>(null)
    const disposedRef = useRef(false)

    useEffect(() => {
      const host = hostRef.current
      if (!host) return
      disposedRef.current = false

      const promise = setupViewer(host)
      readyPromiseRef.current = promise
      promise.catch((err) => {
        console.error(err)
        const detail = err instanceof Error ? err.message : String(err)
        onError?.(`Nie udało się zainicjalizować widoku 3D: ${detail} (sprawdź połączenie z unpkg.com — WASM web-ifc jest ładowany z CDN).`)
      })

      return () => {
        disposedRef.current = true
        promise.then((r) => r.components.dispose()).catch(() => {})
        readyPromiseRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useImperativeHandle(ref, () => ({
      async loadFile(file: File) {
        if (!readyPromiseRef.current) throw new Error('Widok 3D nie jest jeszcze gotowy')
        const r = await readyPromiseRef.current
        if (disposedRef.current) return
        for (const [, model] of r.fragments.list) {
          await r.fragments.core.disposeModel(model.modelId)
        }
        const buffer = new Uint8Array(await file.arrayBuffer())
        await r.ifcLoader.load(buffer, true, file.name.replace(/\.ifc$/i, ''))
      },
      async highlightGuid(guid: string | null) {
        if (!readyPromiseRef.current) return
        const r = await readyPromiseRef.current
        if (disposedRef.current) return
        if (!guid) {
          try {
            await r.highlighter.clear()
          } catch (err) {
            console.error('clear highlight failed', err)
          }
          await r.world.camera.fitToItems()
          return
        }
        const selected = await r.fragments.guidsToModelIdMap([guid])
        const all = await allItemsMap(r.fragments)
        try {
          // dim the whole model except the selection, then highlight the
          // selection on top without wiping the dim pass (removePrevious=false).
          await r.highlighter.highlightByID(DIM_STYLE, all, true, false, selected)
          await r.highlighter.highlightByID(FLAG_STYLE, selected, false, true)
        } catch (err) {
          // The highlighter can throw if its internal event map isn't ready yet
          // (seen once during hot-reload); don't let it crash the review flow —
          // the element is still selected/usable in the sidebar/list/detail panel.
          console.error('highlight failed', err)
        }
      },
    }))

    return <div ref={hostRef} className="viewport-canvas-host" />
  },
)

export default IfcViewer

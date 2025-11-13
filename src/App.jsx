import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import './index.css'

const DEFAULTS = {
  blocks: 8,
  fontSize: 6, // px
  charSpacing: -60, // tracking, interpreted as letter-spacing in thousandths of em-like behavior
  lineHeight: 1,
}

const PresetChip = ({ label, onClick, active, dark }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 rounded-full text-xs font-medium border transition ${active ? (dark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-900 border-zinc-900 text-white') : (dark ? 'border-zinc-700 text-zinc-200' : 'border-zinc-200 text-zinc-700')} active:scale-95`}
    aria-label={`Preset ${label}`}
  >
    {label}
  </button>
)

const Slider = ({ label, min, max, step = 1, value, onChange, suffix = '', dark }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span>{label}</span>
      <span className={`px-2 py-0.5 rounded ${dark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'}`}>{value}{suffix}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-blue-600"
      aria-label={label}
    />
  </div>
)

const Toolbar = ({ settings, setSettings, onApply, onReset, onDownload, dark, setDark }) => {
  const [temp, setTemp] = useState(settings)
  useEffect(() => setTemp(settings), [settings])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-20 ${dark ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'} border-t ${dark ? 'border-zinc-800' : 'border-zinc-200'} p-3`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-md grid grid-cols-2 gap-3">
        <div className="col-span-2 flex items-center justify-between">
          <span className="font-semibold">Controls</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setDark(!dark)} className={`px-3 py-2 rounded-md text-sm border ${dark ? 'border-zinc-700' : 'border-zinc-200'} active:scale-95`} aria-label="Toggle dark mode">{dark ? 'Light' : 'Dark'}</button>
            <button onClick={onDownload} className="px-3 py-2 rounded-md text-sm bg-emerald-600 text-white active:scale-95" aria-label="Export PDF">PDF</button>
          </div>
        </div>

        <div className="col-span-2 grid grid-cols-3 gap-2">
          <PresetChip label="4 blocks" onClick={() => setTemp({ ...temp, blocks: 4 })} active={temp.blocks === 4} dark={dark} />
          <PresetChip label="8 blocks" onClick={() => setTemp({ ...temp, blocks: 8 })} active={temp.blocks === 8} dark={dark} />
          <PresetChip label="12 blocks" onClick={() => setTemp({ ...temp, blocks: 12 })} active={temp.blocks === 12} dark={dark} />
        </div>

        <label className="text-xs col-span-2">Total Blocks
          <input type="number" min={1} max={40} value={temp.blocks}
            onChange={e => setTemp({ ...temp, blocks: parseInt(e.target.value || '0') })}
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'bg-zinc-900 border-zinc-800' : ''}`} />
        </label>

        <div className="col-span-2 grid grid-cols-2 gap-3">
          <Slider label="Font Size" min={4} max={14} value={temp.fontSize} onChange={(v) => setTemp({ ...temp, fontSize: v })} suffix="px" dark={dark} />
          <Slider label="Line Height" min={0.8} max={2.0} step={0.05} value={temp.lineHeight} onChange={(v) => setTemp({ ...temp, lineHeight: v })} dark={dark} />
          <div className="col-span-2">
            <Slider label="Character Spacing" min={-200} max={200} step={5} value={temp.charSpacing} onChange={(v) => setTemp({ ...temp, charSpacing: v })} suffix="" dark={dark} />
          </div>
        </div>

        <div className="col-span-2 grid grid-cols-3 gap-3 pt-1">
          <button onClick={() => { onApply(temp) }} className="rounded-xl py-3 text-sm font-semibold bg-blue-600 text-white active:scale-95">Apply</button>
          <button onClick={onReset} className={`${dark ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-200 text-zinc-900'} rounded-xl py-3 text-sm font-semibold active:scale-95`}>Reset</button>
          <button onClick={onDownload} className="rounded-xl py-3 text-sm font-semibold bg-emerald-600 text-white active:scale-95">PDF</button>
        </div>
      </div>
    </div>
  )
}

function distributeBlocks(total) {
  const perCol = Math.floor(total / 4)
  const extra = total % 4
  const distribution = [perCol, perCol, perCol, perCol]
  for (let i = 0; i < extra; i++) distribution[i]++
  return distribution
}

function computeBlockCapacity(blockHeightPx, fontSizePx, lineHeight, charSpacingPx) {
  const linePx = fontSizePx * lineHeight
  const lines = Math.max(1, Math.floor(blockHeightPx / linePx))
  const avgCharWidth = Math.max(1, 0.6 * fontSizePx + charSpacingPx / 10)
  const charsPerLine = Math.max(5, Math.floor((240) / avgCharWidth))
  return Math.max(10, lines * charsPerLine)
}

const BlockEditor = ({ id, value, onChange, capacity, styles, dark, onExpand, onClear }) => {
  const [remaining, setRemaining] = useState(capacity)
  const quillRef = useRef(null)

  useEffect(() => {
    setRemaining(capacity - (stripHtml(value).length))
  }, [capacity, value])

  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['clean']
    ],
  }), [])

  const handleChange = (html) => {
    const plainLen = stripHtml(html).length
    if (plainLen > capacity) return
    setRemaining(capacity - plainLen)
    onChange(html)
  }

  const used = Math.min(capacity, capacity - remaining)
  const pct = Math.max(0, Math.min(100, Math.round((used / capacity) * 100)))

  return (
    <div className={`relative rounded-md overflow-hidden border ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`} style={{ ...styles }}>
      <ReactQuill
        ref={quillRef}
        value={value}
        onChange={handleChange}
        modules={modules}
        theme="snow"
        style={{ height: '100%' }}
      />
      <div className={`absolute right-2 bottom-2 left-2 flex items-center gap-2`}>
        <div className={`text-[10px] px-2 py-1 rounded-md ${dark ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' : 'bg-white/90 text-zinc-700 border border-zinc-200'}`}>
          {remaining} left
        </div>
        <button onClick={() => onExpand(id, value, capacity)} className={`${dark ? 'bg-zinc-800 text-zinc-100 border-zinc-700' : 'bg-white text-zinc-800 border-zinc-200'} text-[10px] px-2 py-1 border rounded-md active:scale-95`} aria-label="Expand editor">Expand</button>
        <button onClick={() => onClear(id)} className={`${dark ? 'bg-zinc-800 text-red-300 border-zinc-700' : 'bg-white text-red-600 border-zinc-200'} text-[10px] px-2 py-1 border rounded-md active:scale-95`} aria-label="Clear block">Clear</button>
      </div>
      <div className="absolute left-0 right-0 bottom-0 h-1 bg-transparent">
        <div className={`h-full ${dark ? 'bg-blue-600/70' : 'bg-blue-600'}`} style={{ width: `${pct}%`, transition: 'width 200ms ease' }} />
      </div>
    </div>
  )
}

function stripHtml(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html || ''
  return tmp.textContent || tmp.innerText || ''
}

const FocusModal = ({ open, onClose, onSave, initialValue, capacity, dark, styles }) => {
  const [val, setVal] = useState(initialValue || '')
  useEffect(() => setVal(initialValue || ''), [initialValue, open])

  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['clean']
    ],
  }), [])

  const remaining = Math.max(0, capacity - stripHtml(val).length)

  return (
    <div className={`${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} fixed inset-0 z-40 transition`}> 
      <div className={`absolute inset-0 ${dark ? 'bg-black/60' : 'bg-black/40'}`} onClick={onClose} />
      <div className={`absolute inset-x-3 top-[10vh] rounded-2xl shadow-xl border ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <div className={`flex items-center justify-between px-3 py-2 border-b ${dark ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <span className="text-sm font-medium">Focus editor</span>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2 py-0.5 rounded ${dark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'}`}>{remaining} left</span>
            <button onClick={() => onSave(val)} className="px-3 py-1.5 rounded-md text-sm bg-blue-600 text-white active:scale-95">Save</button>
            <button onClick={onClose} className={`px-3 py-1.5 rounded-md text-sm ${dark ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-100 text-zinc-900'} active:scale-95`}>Close</button>
          </div>
        </div>
        <div className="p-3">
          <div className={`rounded-md overflow-hidden border ${dark ? 'border-zinc-800' : 'border-zinc-200'}`} style={{ height: '60vh', ...styles }}>
            <ReactQuill value={val} onChange={(html) => {
              if (stripHtml(html).length > capacity) return
              setVal(html)
            }} modules={modules} theme="snow" style={{ height: '100%' }} />
          </div>
          <div className="h-1 mt-2 bg-transparent">
            <div className={`${dark ? 'bg-blue-600/70' : 'bg-blue-600'} h-full`} style={{ width: `${Math.min(100, (stripHtml(val).length / capacity) * 100)}%`, transition: 'width 200ms ease' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useState(false)
  const [settings, setSettings] = useState(() => {
    const fromSession = sessionStorage.getItem('settings')
    return fromSession ? JSON.parse(fromSession) : DEFAULTS
  })
  const [contents, setContents] = useState(() => {
    const fromSession = sessionStorage.getItem('contents')
    return fromSession ? JSON.parse(fromSession) : {}
  })
  const [showGuides, setShowGuides] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const [focusOpen, setFocusOpen] = useState(false)
  const [focusMeta, setFocusMeta] = useState({ id: null, capacity: 0, value: '' })

  const a4Ref = useRef(null)

  const distribution = useMemo(() => distributeBlocks(settings.blocks || 0), [settings.blocks])

  useEffect(() => {
    sessionStorage.setItem('settings', JSON.stringify(settings))
    setSavedFlash(true)
    const t = setTimeout(() => setSavedFlash(false), 800)
    return () => clearTimeout(t)
  }, [settings])

  useEffect(() => {
    sessionStorage.setItem('contents', JSON.stringify(contents))
    setSavedFlash(true)
    const t = setTimeout(() => setSavedFlash(false), 800)
    return () => clearTimeout(t)
  }, [contents])

  const applySettings = (next) => setSettings(next)
  const resetAll = () => {
    setSettings(DEFAULTS)
    setContents({})
    sessionStorage.clear()
  }

  const computeStyles = () => ({
    fontSize: settings.fontSize,
    letterSpacing: `${settings.charSpacing / 100}em`,
    lineHeight: settings.lineHeight,
  })

  const buildLayout = () => {
    const cols = distribution
    const totalHeight = 1122 // approximate px for A4 scaled container
    const colPadding = 12
    const gaps = 8

    return cols.map((count, colIdx) => {
      const blocks = []
      const innerHeight = totalHeight - colPadding * 2 - gaps * (count - 1)
      const blockHeight = Math.floor(innerHeight / (count || 1))
      for (let i = 0; i < count; i++) {
        const id = `${colIdx}-${i}`
        const capacity = computeBlockCapacity(blockHeight, settings.fontSize, settings.lineHeight, settings.charSpacing)
        blocks.push({ id, capacity, height: blockHeight })
      }
      return blocks
    })
  }

  const layout = useMemo(() => buildLayout(), [settings, distribution])

  const handleDownload = async () => {
    const { default: html2canvas } = await import('html2canvas')
    const { jsPDF } = await import('jspdf')
    const node = a4Ref.current
    if (!node) return

    const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = 210
    const pageHeight = 297
    const imgWidth = pageWidth
    const imgHeight = canvas.height * imgWidth / canvas.width
    const y = (pageHeight - imgHeight) / 2
    pdf.addImage(imgData, 'PNG', 0, Math.max(0, y), imgWidth, imgHeight)
    pdf.save('a4-text-blocks.pdf')
  }

  const onExpand = (id, value, capacity) => {
    setFocusMeta({ id, value, capacity })
    setFocusOpen(true)
  }
  const onClear = (id) => setContents(prev => ({ ...prev, [id]: '' }))

  const renderColumn = (colBlocks, colIdx) => {
    return (
      <div key={colIdx} className={`flex flex-col gap-2 p-3 relative`} style={{ width: '25%' }}>
        {colIdx !== 3 && (
          <div className={`absolute top-2 bottom-2 right-0 w-px ${dark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        )}
        {colBlocks.map((b) => (
          <BlockEditor
            key={b.id}
            id={b.id}
            value={contents[b.id] || ''}
            onChange={(html) => setContents(prev => ({ ...prev, [b.id]: html }))}
            capacity={b.capacity}
            styles={{ height: b.height, ...computeStyles() }}
            dark={dark}
            onExpand={onExpand}
            onClear={onClear}
          />
        ))}
      </div>
    )
  }

  // Guides styles
  const linePx = settings.fontSize * settings.lineHeight
  const guidesBg = showGuides
    ? {
        backgroundImage: `repeating-linear-gradient(to bottom, ${dark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.15)'} 0, ${dark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.15)'} 1px, transparent 1px, transparent ${linePx}px)`
      }
    : {}

  return (
    <div className={`${dark ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'} min-h-[100dvh] pb-40`}>
      <header className={`sticky top-0 z-10 backdrop-blur ${dark ? 'bg-black/60 border-zinc-800' : 'bg-white/70 border-zinc-200'} border-b`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold">A4 Sheet Editor</h1>
            <span className={`text-[11px] px-2 py-0.5 rounded ${dark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'}`}>4 columns</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGuides(v => !v)} className={`px-2.5 py-1.5 rounded-md text-xs border ${showGuides ? 'bg-blue-600 text-white border-blue-600' : (dark ? 'border-zinc-700' : 'border-zinc-200')} active:scale-95`} aria-label="Toggle guides">{showGuides ? 'Guides On' : 'Guides'}</button>
            <button onClick={() => setDark(!dark)} className={`px-2.5 py-1.5 rounded-md text-xs border ${dark ? 'border-zinc-700' : 'border-zinc-200'} active:scale-95`} aria-label="Toggle dark mode">{dark ? 'Light' : 'Dark'}</button>
            <button onClick={handleDownload} className="px-2.5 py-1.5 rounded-md text-xs bg-emerald-600 text-white active:scale-95" aria-label="Export PDF">PDF</button>
          </div>
        </div>
        {savedFlash && (
          <div className="max-w-md mx-auto px-4 pb-2">
            <div className={`inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded ${dark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'}`}>
              <span>Saved</span>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-3 pt-4 pb-24 space-y-4">
        <section className={`rounded-2xl shadow-sm border overflow-hidden ${dark ? 'bg-zinc-950 border-zinc-800' : 'bg-white'}`}>
          <div className={`px-4 py-3 border-b text-sm font-medium ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>Preview</div>
          <div className="p-3">
            <div className="w-full flex justify-center">
              <div ref={a4Ref} className="relative shadow-md border rounded-xl overflow-hidden"
                   style={{
                     width: '100%',
                     maxWidth: 320,
                     aspectRatio: '210 / 297',
                     display: 'flex',
                     flexDirection: 'row',
                     background: '#ffffff',
                   }}>
                {/* Guides overlay */}
                {showGuides && (
                  <div className="absolute inset-0 pointer-events-none" style={guidesBg} />
                )}
                {layout.map((colBlocks, idx) => renderColumn(colBlocks, idx))}
              </div>
            </div>
            <div className="mt-3 text-[11px] leading-relaxed">
              <p className={`mb-1 ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>• Content autosaves for this tab. Capacity is enforced by plain-text length.</p>
              <p className={`${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>• Tip: Tap Expand for full-screen editing. Toggle Guides to align lines and spacing. Export to PDF from the header or the bottom bar.</p>
            </div>
          </div>
        </section>
      </main>

      <Toolbar
        settings={settings}
        setSettings={setSettings}
        onApply={applySettings}
        onReset={resetAll}
        onDownload={handleDownload}
        dark={dark}
        setDark={setDark}
      />

      <FocusModal
        open={focusOpen}
        onClose={() => setFocusOpen(false)}
        onSave={(val) => {
          if (!focusMeta.id) return
          setContents(prev => ({ ...prev, [focusMeta.id]: val }))
          setFocusOpen(false)
        }}
        initialValue={focusMeta.value}
        capacity={focusMeta.capacity}
        dark={dark}
        styles={computeStyles()}
      />
    </div>
  )
}

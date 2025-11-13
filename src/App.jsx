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

const Toolbar = ({ settings, setSettings, onApply, onReset, onDownload, dark, setDark }) => {
  const [temp, setTemp] = useState(settings)
  useEffect(() => setTemp(settings), [settings])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-20 ${dark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-zinc-900'} border-t ${dark ? 'border-zinc-800' : 'border-zinc-200'} p-3`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-md grid grid-cols-2 gap-3">
        <div className="col-span-2 flex items-center justify-between">
          <span className="font-semibold">Controls</span>
          <button onClick={() => setDark(!dark)} className="px-3 py-2 rounded-md text-sm border border-current/20">{dark ? 'Light' : 'Dark'}</button>
        </div>

        <label className="text-xs">Total Blocks
          <input type="number" min={1} max={40} value={temp.blocks}
            onChange={e => setTemp({ ...temp, blocks: parseInt(e.target.value || '0') })}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>

        <label className="text-xs">Font Size (px)
          <input type="number" min={4} max={20} value={temp.fontSize}
            onChange={e => setTemp({ ...temp, fontSize: parseFloat(e.target.value || '0') })}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>

        <label className="text-xs">Character Spacing
          <input type="number" min={-200} max={200} value={temp.charSpacing}
            onChange={e => setTemp({ ...temp, charSpacing: parseFloat(e.target.value || '0') })}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>

        <label className="text-xs">Line Spacing
          <input type="number" step="0.1" min={0.8} max={3} value={temp.lineHeight}
            onChange={e => setTemp({ ...temp, lineHeight: parseFloat(e.target.value || '0') })}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>

        <div className="col-span-2 grid grid-cols-3 gap-3 pt-1">
          <button onClick={() => { onApply(temp) }} className="rounded-xl py-3 text-sm font-semibold bg-blue-600 text-white active:scale-95">Apply</button>
          <button onClick={onReset} className="rounded-xl py-3 text-sm font-semibold bg-zinc-200 text-zinc-900 active:scale-95">Reset</button>
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
  // Estimate characters = (lines per block) * (avg chars per line)
  const linePx = fontSizePx * lineHeight
  const lines = Math.max(1, Math.floor(blockHeightPx / linePx))
  // Assume average character width ~ 0.6 * fontSize + letter-spacing effect
  const avgCharWidth = Math.max(1, 0.6 * fontSizePx + charSpacingPx / 10)
  const charsPerLine = Math.max(5, Math.floor((240 /* column inner px estimate */) / avgCharWidth))
  return Math.max(10, lines * charsPerLine)
}

const BlockEditor = ({ id, value, onChange, capacity, styles, dark }) => {
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
    if (plainLen > capacity) {
      // Block extra input by reverting
      const delta = quillRef.current?.getEditor().getContents()
      // No hard trim to avoid breaking tags; just ignore new input
      return
    }
    setRemaining(capacity - plainLen)
    onChange(html)
  }

  return (
    <div className={`relative rounded-lg overflow-hidden ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`} style={{ ...styles }}>
      <ReactQuill
        ref={quillRef}
        value={value}
        onChange={handleChange}
        modules={modules}
        theme="snow"
        style={{ height: '100%' }}
      />
      <div className={`absolute right-2 bottom-2 text-xs px-2 py-1 rounded-md ${dark ? 'bg-zinc-800 text-zinc-200' : 'bg-white/80 text-zinc-700'} border ${dark ? 'border-zinc-700' : 'border-zinc-200'}`}>
        {remaining} chars left
      </div>
    </div>
  )
}

function stripHtml(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html || ''
  return tmp.textContent || tmp.innerText || ''
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

  const a4Ref = useRef(null)

  const distribution = useMemo(() => distributeBlocks(settings.blocks || 0), [settings.blocks])

  useEffect(() => {
    sessionStorage.setItem('settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    sessionStorage.setItem('contents', JSON.stringify(contents))
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

    const canvas = await html2canvas(node, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = 210
    const pageHeight = 297
    // compute image dimensions to fit page while maintaining A4 aspect
    const imgWidth = pageWidth
    const imgHeight = canvas.height * imgWidth / canvas.width
    const y = (pageHeight - imgHeight) / 2
    pdf.addImage(imgData, 'PNG', 0, Math.max(0, y), imgWidth, imgHeight)
    pdf.save('a4-text-blocks.pdf')
  }

  const renderColumn = (colBlocks, colIdx) => {
    return (
      <div key={colIdx} className="flex flex-col gap-2 p-3" style={{ width: '25%' }}>
        {colBlocks.map((b) => (
          <BlockEditor
            key={b.id}
            id={b.id}
            value={contents[b.id] || ''}
            onChange={(html) => setContents(prev => ({ ...prev, [b.id]: html }))}
            capacity={b.capacity}
            styles={{ height: b.height, ...computeStyles() }}
            dark={dark}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`${dark ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'} min-h-[100dvh] pb-40`}>
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold">A4 Sheet Text Block Editor</h1>
          <span className="text-xs opacity-70">Mobile</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-3 pt-4 pb-24 space-y-4">
        <section className="rounded-2xl shadow-sm border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-zinc-50 text-sm font-medium">Preview</div>
          <div className="p-3">
            <div className="w-full flex justify-center">
              <div ref={a4Ref} className="relative bg-white shadow-md border rounded-xl overflow-hidden"
                   style={{
                     width: '100%',
                     maxWidth: 320, // mobile card width
                     aspectRatio: '210 / 297', // maintain A4 ratio
                     display: 'flex',
                     flexDirection: 'row',
                   }}>
                {/* 4 columns */}
                {layout.map((colBlocks, idx) => renderColumn(colBlocks, idx))}
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2">4 columns. Content autosaves in this tab only.</p>
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
    </div>
  )
}

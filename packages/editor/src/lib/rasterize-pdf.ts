let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function loadPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF rasterization is only available in the browser')
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
      return mod
    })
  }
  return pdfjsPromise
}

export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await loadPdfjs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const count = pdf.numPages
  await pdf.destroy()
  return count
}

export async function rasterizePdfPage(
  file: File,
  pageIndex = 1,
  targetWidth = 2048,
): Promise<Blob> {
  const pdfjs = await loadPdfjs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise

  if (pageIndex < 1 || pageIndex > pdf.numPages) {
    await pdf.destroy()
    throw new Error(`Page ${pageIndex} out of range (1..${pdf.numPages})`)
  }

  const page = await pdf.getPage(pageIndex)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = targetWidth / baseViewport.width
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) {
    await pdf.destroy()
    throw new Error('Could not get 2D canvas context for PDF rasterization')
  }

  await page.render({ canvasContext: context, viewport, canvas }).promise

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null'))),
      'image/png',
    )
  })

  await pdf.destroy()
  return blob
}

import {
  type AnyNodeId,
  GuideNode,
  type GuideNode as GuideNodeType,
  saveAsset,
} from '@pascal-app/core'
import { getPdfPageCount, rasterizePdfPage } from './rasterize-pdf'

export function getGuideImageName(filename: string) {
  const trimmed = filename.trim()
  if (!trimmed) {
    return 'Guide image'
  }

  const dotIndex = trimmed.lastIndexOf('.')
  return dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

async function resolveGuideSourceFile(file: File): Promise<File> {
  if (!isPdfFile(file)) return file

  const pageCount = await getPdfPageCount(file)
  let pageIndex = 1
  if (pageCount > 1) {
    const answer = window.prompt(
      `PDF has ${pageCount} pages. Which page to use as reference? (1-${pageCount})`,
      '1',
    )
    if (answer === null) {
      throw new Error('PDF import cancelled')
    }
    const parsed = Number.parseInt(answer, 10)
    if (Number.isNaN(parsed) || parsed < 1 || parsed > pageCount) {
      throw new Error(`Invalid page number "${answer}"`)
    }
    pageIndex = parsed
  }

  const blob = await rasterizePdfPage(file, pageIndex)
  const baseName = getGuideImageName(file.name)
  const suffix = pageCount > 1 ? `-page-${pageIndex}` : ''
  return new File([blob], `${baseName}${suffix}.png`, { type: 'image/png' })
}

export async function createLocalGuideImage({
  createNode,
  file,
  levelId,
  position = [0, 0, 0],
}: {
  createNode: (node: GuideNodeType, parentId: AnyNodeId) => void
  file: File
  levelId: string
  position?: [number, number, number]
}) {
  const sourceFile = await resolveGuideSourceFile(file)
  const assetUrl = await saveAsset(sourceFile)
  const guide = GuideNode.parse({
    name: getGuideImageName(sourceFile.name),
    url: assetUrl,
    position,
    rotation: [0, 0, 0],
    scale: 1,
    opacity: 50,
    scaleReference: null,
  })

  createNode(guide, levelId as AnyNodeId)
  return guide
}

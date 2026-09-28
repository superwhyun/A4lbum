// build: 판정 → 선별 → 후보 앨범 N개 → 점수 → 최종 A4 PDF
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { loadTemplates } from "@/cli/plan/templates"
import { planVariants, toRenderPhotos } from "@/cli/plan/variants"
import { createRenderer } from "@/cli/render/pdf"
import { screenPhotos, type RejectedPhoto, type SelectedPhoto } from "@/cli/select/screen"
import type { VisionProvider } from "@/cli/select/providers"
import type { Judgement, ScanManifest, Variant } from "@/cli/types"
import type { AlbumDensity } from "@/types/album"

const FINAL_PDF = "final.pdf"
const REPORT_JSON = "report.json"
const VARIANTS_DIR = "variants"

export interface BuildOptions {
  manifest: ScanManifest
  outDir: string
  provider: VisionProvider
  theme: string
  /** 표지(첫 페이지) 타이틀. 미지정 시 대표 사진 촬영일 사용 */
  title?: string
  orientation: "portrait" | "landscape"
  density: AlbumDensity
  variants: number
  seed: number
  minScore: number
  duplicateDistance: number
  maxPhotos?: number
  /** 후보 전부를 PDF로 남길지 (기본은 최종 1개만 렌더) */
  renderAll: boolean
  showMetadata: boolean
  onLog?: (message: string) => void
}

export interface BuildResult {
  kept: SelectedPhoto[]
  rejected: RejectedPhoto[]
  judgements: Judgement[]
  variants: Variant[]
  winner: Variant
  finalPath: string
  variantPaths: string[]
  reportPath: string
}

export async function buildAlbums(options: BuildOptions): Promise<BuildResult> {
  const log = options.onLog ?? (() => undefined)
  const photos = options.manifest.photos

  if (photos.length === 0) throw new Error("매니페스트에 사진이 없습니다")

  log(`판정 시작 (${options.provider.name}, ${photos.length}장)`)
  const judgements = await options.provider.judge(photos)

  const { kept, rejected } = screenPhotos(photos, judgements, {
    minScore: options.minScore,
    duplicateDistance: options.duplicateDistance,
    maxPhotos: options.maxPhotos,
  })

  log(`선별 결과: 채택 ${kept.length}장 / 제외 ${rejected.length}장`)
  if (kept.length === 0) {
    throw new Error("채택된 사진이 없습니다. --min-score를 낮추거나 판정 기준을 확인하세요")
  }

  const templates = loadTemplates(options.orientation)
  const variants = planVariants({
    photos: kept,
    templates,
    theme: options.theme,
    orientation: options.orientation,
    density: options.density,
    count: Math.max(1, options.variants),
    seed: options.seed,
    focusOnSubject: true,
  })

  const winner = variants[0]
  // --title 지정 시 모든 후보의 표지(첫 페이지) 타이틀을 교체한다 (CLI 전용 — 웹 공유 코드 건드리지 않음)
  if (options.title) {
    for (const variant of variants) {
      const cover = variant.album.pages[0]
      if (cover) cover.title = options.title
    }
  }
  log(
    `후보 ${variants.length}개 생성 — 최고 점수 ${winner.score.total.toFixed(3)} ` +
      `(seed=${winner.seed}, ${winner.album.pages.length}페이지)`,
  )

  await mkdir(options.outDir, { recursive: true })

  const renderer = await createRenderer(
    kept.map(({ photo }) => ({ id: photo.id, path: photo.path })),
  )
  const renderPhotos = toRenderPhotos(kept, renderer.photoUrl)

  const variantPaths: string[] = []
  let finalPath = ""

  try {
    const toRender = options.renderAll ? variants : [winner]

    if (options.renderAll) {
      await mkdir(join(options.outDir, VARIANTS_DIR), { recursive: true })
    }

    for (const variant of toRender) {
      const pdf = await renderer.render(variant.album, renderPhotos, options.showMetadata)

      if (variant === winner) {
        finalPath = join(options.outDir, FINAL_PDF)
        await writeFile(finalPath, pdf)
        log(`최종 앨범 저장: ${finalPath} (${(pdf.length / 1024 / 1024).toFixed(1)}MB)`)
      }

      if (options.renderAll) {
        const variantPath = join(options.outDir, VARIANTS_DIR, `variant-${variant.index}.pdf`)
        await writeFile(variantPath, pdf)
        variantPaths.push(variantPath)
      }
    }
  } finally {
    await renderer.close()
  }

  const reportPath = join(options.outDir, REPORT_JSON)
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDir: options.manifest.sourceDir,
        provider: options.provider.name,
        settings: {
          theme: options.theme,
          orientation: options.orientation,
          density: options.density,
          variants: options.variants,
          seed: options.seed,
          minScore: options.minScore,
          duplicateDistance: options.duplicateDistance,
          maxPhotos: options.maxPhotos,
        },
        winner: { index: winner.index, seed: winner.seed, score: winner.score, pages: winner.album.pages.length },
        variants: variants.map((variant) => ({
          index: variant.index,
          seed: variant.seed,
          pages: variant.album.pages.length,
          score: variant.score,
        })),
        kept: kept.map(({ photo, judgement }) => ({
          id: photo.id,
          fileName: photo.fileName,
          date: photo.date,
          score: judgement.score,
          subject: judgement.subject,
          source: judgement.source,
        })),
        rejected: rejected.map(({ photo, reason }) => ({
          id: photo.id,
          fileName: photo.fileName,
          reason,
        })),
        outputs: { final: finalPath, variants: variantPaths },
      },
      null,
      2,
    ),
    "utf8",
  )

  return { kept, rejected, judgements, variants, winner, finalPath, variantPaths, reportPath }
}

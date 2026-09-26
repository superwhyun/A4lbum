// lib/default-templates.ts(웹과 공용 자산)를 레이아웃 엔진이 쓰는 형태로 변환
import { defaultTemplates, type DefaultTemplate } from "@/lib/default-templates"
import type { LayoutTemplate } from "@/types/album"

function toSlug(name: string, index: number): string {
  const slug = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w가-힣-]/g, "")
  return `default-${index}-${slug}`
}

export function toLayoutTemplate(template: DefaultTemplate, index: number): LayoutTemplate {
  return {
    id: toSlug(template.name, index),
    name: template.name,
    photoCount: template.config.photoCount,
    orientation: template.config.orientation,
    layouts: template.config.layouts,
  }
}

/** CLI에서 사용할 템플릿 집합 */
export function loadTemplates(orientation?: "portrait" | "landscape"): LayoutTemplate[] {
  const all = defaultTemplates.map(toLayoutTemplate)
  return orientation ? all.filter((template) => template.orientation === orientation) : all
}

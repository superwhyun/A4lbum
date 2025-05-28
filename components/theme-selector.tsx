"use client"

import { THEMES, type Theme } from "@/types/album"

interface ThemeSelectorProps {
  selectedTheme: Theme
  onThemeChange: (theme: Theme) => void
}

export function ThemeSelector({ selectedTheme, onThemeChange }: ThemeSelectorProps) {
  const getThemeColors = (theme: Theme) => {
    const colors = {
      classic: "bg-amber-100 border-amber-300",
      modern: "bg-gray-100 border-gray-300",
      vintage: "bg-yellow-100 border-yellow-300",
      minimal: "bg-white border-gray-200",
      colorful: "bg-rainbow-100 border-rainbow-300",
      elegant: "bg-purple-100 border-purple-300",
      rustic: "bg-orange-100 border-orange-300",
      artistic: "bg-pink-100 border-pink-300",
      nature: "bg-green-100 border-green-300",
      urban: "bg-blue-100 border-blue-300",
      black: "bg-gray-900 border-gray-700 text-white", // Added black theme style
    }
    return colors[theme] || colors.classic
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">테마 선택</h3>
      <div className="grid grid-cols-5 gap-3">
        {THEMES.map((theme) => (
          <button
            key={theme}
            onClick={() => onThemeChange(theme)}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedTheme === theme ? "ring-2 ring-blue-500 ring-offset-2" : ""
            } ${getThemeColors(theme)}`}
          >
            <div className="text-sm font-medium capitalize">{theme}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

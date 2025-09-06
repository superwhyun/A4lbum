import type React from "react"
import type { Metadata } from "next"
import { Inter, Nanum_Pen_Script } from "next/font/google"
import "./globals.css"
import { AlbumProvider } from "@/contexts/album-context"
import { AuthProvider } from "@/contexts/auth-context"
import { Header } from "@/components/header"
import { GoogleOAuthProvider } from '@react-oauth/google'

const inter = Inter({ subsets: ["latin"] })
const nanumPenScript = Nanum_Pen_Script({ 
  subsets: ["latin"], 
  weight: "400",
  variable: "--font-nanum-pen"
})

export const metadata: Metadata = {
  title: "A4lbum - 나만의 A4 앨범 만들기",
  description: "사진을 드래그&드롭으로 업로드하여 아름다운 A4 크기의 앨범을 만들어보세요",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} ${nanumPenScript.variable}`}>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
          <AuthProvider>
            <AlbumProvider>
              <LayoutWithHeader>{children}</LayoutWithHeader>
            </AlbumProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  )
}

// --- Add below: ---

import LayoutWithHeader from "@/components/layout-with-header";

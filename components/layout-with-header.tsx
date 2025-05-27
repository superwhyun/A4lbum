"use client";

import React, { useState } from "react";
import { useAlbum } from "@/contexts/album-context";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/header";

type LayoutWithHeaderProps = {
  children: React.ReactNode;
};

export default function LayoutWithHeader({ children }: LayoutWithHeaderProps) {
  const { album, createAlbum } = useAlbum();
  const { user } = useAuth();
  const [selectedTheme, setSelectedTheme] = useState("classic");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [showPreview, setShowPreview] = useState(true);

  const handleCreateAlbum = () => {
    createAlbum(selectedTheme, orientation);
    setShowPreview(true);
  };

  const handleGoToPreview = () => {
    setShowPreview(true);
  };

  return (
    <>
      <Header
        onGoToPreview={handleGoToPreview}
        albumExists={!!album}
      />
      {/* Pass preview state/handlers to children via context or props if needed */}
      {children}
    </>
  );
}
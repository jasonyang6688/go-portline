import { useEffect } from "react";
import type { RefObject } from "react";

export function useCommandPaletteShortcut(onTogglePalette: () => void) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onTogglePalette();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onTogglePalette]);
}

export function useConnectionMenuDismiss({
  connectionMenuOpen,
  connectionMenuRef,
  onClose,
}: {
  connectionMenuOpen: boolean;
  connectionMenuRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!connectionMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && connectionMenuRef.current?.contains(target)) {
        return;
      }
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [connectionMenuOpen, connectionMenuRef, onClose]);
}

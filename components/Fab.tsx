"use client";

import { Plus } from "lucide-react";

interface FabProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function Fab({ onClick, ariaLabel = "Add event" }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}

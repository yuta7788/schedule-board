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
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md shadow-indigo-500/15 transition hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { LocationRow } from "@/lib/types/database";

interface LocationComboboxProps {
  locations: LocationRow[];
  value: string;
  onSelect: (location: LocationRow | null) => void;
  onInputChange?: (value: string) => void;
  id?: string;
  placeholder?: string;
  "aria-label"?: string;
}

export function LocationCombobox({
  locations,
  value,
  onSelect,
  onInputChange,
  id = "event-location",
  placeholder = "Type or select location",
  "aria-label": ariaLabel = "Location",
}: LocationComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered =
    query === ""
      ? locations
      : locations.filter((loc) => loc.name.toLowerCase().includes(query));

  function handleFocus() {
    setIsOpen(true);
  }

  function handleSelect(loc: LocationRow) {
    onSelect(loc);
    setIsOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (!v.trim()) {
      onSelect(null);
    }
    if (onInputChange) {
      onInputChange(v);
    }
    setIsOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? "location-listbox" : undefined}
          aria-label={ariaLabel}
          className="w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-3 pr-9 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
          <ChevronDown
            className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </div>
      {isOpen && (
        <ul
          id="location-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white/95 py-1.5 shadow-lg ring-1 ring-slate-900/5 backdrop-blur-sm"
        >
          {filtered.length === 0 ? (
            <li
              className="px-3 py-2.5 text-sm text-slate-500"
              role="option"
              aria-selected={false}
            >
              No matching location
            </li>
          ) : (
            filtered.map((loc) => (
              <li
                key={loc.id}
                role="option"
                aria-selected={loc.name === value}
                onClick={() => handleSelect(loc)}
                onMouseDown={(e) => e.preventDefault()}
                className="cursor-pointer rounded-lg px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-100 focus:bg-slate-100"
              >
                {loc.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

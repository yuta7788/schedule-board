"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { LocationRow } from "@/lib/types/database";

interface LocationComboboxProps {
  locations: LocationRow[];
  value: string;
  onSelect: (location: LocationRow | null) => void;
  id?: string;
  placeholder?: string;
  "aria-label"?: string;
}

export function LocationCombobox({
  locations,
  value,
  onSelect,
  id = "event-location",
  placeholder = "Type or select location",
  "aria-label": ariaLabel = "Location",
}: LocationComboboxProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setInputValue(value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = inputValue.trim().toLowerCase();
  const filtered =
    query === ""
      ? locations
      : locations.filter((loc) => loc.name.toLowerCase().includes(query));

  function handleFocus() {
    setIsOpen(true);
  }

  function handleSelect(loc: LocationRow) {
    setInputValue(loc.name);
    onSelect(loc);
    setIsOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    if (!v.trim()) {
      onSelect(null);
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
          value={inputValue}
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
          className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500" role="option">
              No matching location
            </li>
          ) : (
            filtered.map((loc) => (
              <li
                key={loc.id}
                role="option"
                aria-selected={loc.name === inputValue}
                onClick={() => handleSelect(loc)}
                onMouseDown={(e) => e.preventDefault()}
                className="cursor-pointer px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 focus:bg-slate-100"
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

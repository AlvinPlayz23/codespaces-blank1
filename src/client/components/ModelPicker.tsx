import { useEffect, useRef, useState } from "react";
import type { ModelInfo } from "../../shared/types";
import { CheckIcon, ChevronIcon } from "./Icons";

interface ModelPickerProps {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
}

export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const current = models.find((model) => model.id === value) ?? models[0];

  return (
    <div className="model-picker" ref={ref}>
      <button
        type="button"
        className="model-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current?.label ?? value}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="model-menu" role="listbox">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              role="option"
              aria-selected={model.id === value}
              className="model-option"
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
            >
              <span className="label">
                <span>{model.label}</span>
                {model.id === value && <CheckIcon />}
              </span>
              <span className="desc">{model.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

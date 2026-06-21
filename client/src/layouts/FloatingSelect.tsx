import { forwardRef, useState, ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface FloatingSelectProps {
  label: string;
  icon?: ReactNode;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
}

export const FloatingSelect = forwardRef<HTMLButtonElement, FloatingSelectProps>(
  ({ label, icon, options, value, onChange, error }, ref) => {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find((o) => o.value === value)?.label;
    const isFloating = Boolean(value) || open;

    return (
      <div className="relative">
        <Select.Root value={value} onValueChange={onChange} onOpenChange={setOpen} open={open}>
          <Select.Trigger
            ref={ref}
            className={`
              relative w-full flex items-center text-left border rounded-xl transition-all duration-200 bg-white
              outline-none focus:outline-none cursor-pointer
              ${error
                ? "border-red-400 shadow-sm shadow-red-100"
                : open
                  ? "border-indigo-400 shadow-sm shadow-indigo-100"
                  : "border-gray-200 hover:border-gray-300"
              }
            `}
            onClick={() => setOpen(true)}
          >
            {icon && (
              <div className={`absolute left-3.5 transition-colors duration-200 ${open ? "text-indigo-500" : "text-gray-400"}`}>
                {icon}
              </div>
            )}
            <div className={`flex-1 pt-5 pb-1 px-3.5 ${icon ? "pl-10" : "pl-3.5"} pr-10`}>
              <Select.Value asChild>
                <span className={selectedLabel ? "text-gray-800" : "text-transparent"}>
                  {selectedLabel || label}
                </span>
              </Select.Value>
            </div>
            <label className={`
              absolute left-3.5 transition-all duration-200 pointer-events-none select-none
              ${icon ? "left-10" : "left-3.5"}
              ${isFloating
                ? "top-1.5 text-[10px] font-semibold tracking-wide " + (error ? "text-red-500" : "text-indigo-500")
                : "top-3.5 text-sm text-gray-400"
              }
            `}>
              {label}
            </label>
            <Select.Icon className="absolute right-3.5">
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content
              className="z-50 overflow-hidden bg-white border border-gray-200 rounded-xl shadow-xl"
              position="popper"
              sideOffset={6}
              style={{ width: "var(--radix-select-trigger-width)" }}
            >
              <Select.Viewport className="p-1">
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer outline-none hover:bg-indigo-50 data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 transition-colors duration-100 text-sm text-gray-700"
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className="ml-auto">
                      <Check size={14} className="text-indigo-600" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>

        {error && (
          <p className="mt-1 pl-1 text-red-500" style={{ fontSize: "0.72rem" }}>{error}</p>
        )}
      </div>
    );
  }
);
FloatingSelect.displayName = "FloatingSelect";

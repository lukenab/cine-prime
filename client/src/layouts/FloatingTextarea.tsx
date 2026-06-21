import { forwardRef, useState, TextareaHTMLAttributes, ReactNode } from "react";

interface FloatingTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  icon?: ReactNode;
  error?: string;
}

export const FloatingTextarea = forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(
  ({ label, icon, error, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const hasValue = Boolean(props.value || props.defaultValue);
    const isFloating = focused || hasValue || Boolean(props.placeholder);

    return (
      <div className="relative">
        <div className={`
          relative flex border rounded-xl transition-all duration-200 bg-white
          ${error
            ? "border-red-400 shadow-sm shadow-red-100"
            : focused
              ? "border-indigo-400 shadow-sm shadow-indigo-100"
              : "border-gray-200 hover:border-gray-300"
          }
        `}>
          {icon && (
            <div className={`absolute left-3.5 top-4 transition-colors duration-200 ${focused ? "text-indigo-500" : "text-gray-400"}`}>
              {icon}
            </div>
          )}
          <textarea
            ref={ref}
            rows={3}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={`
              peer w-full bg-transparent outline-none pt-6 pb-2 px-3.5 resize-none
              ${icon ? "pl-10" : "pl-3.5"}
              text-gray-800 placeholder-transparent
              ${className || ""}
            `}
            placeholder={label}
            {...props}
          />
          <label className={`
            absolute left-3.5 transition-all duration-200 pointer-events-none select-none
            ${icon ? "left-10" : "left-3.5"}
            ${isFloating || focused
              ? "top-1.5 text-[10px] font-semibold tracking-wide " + (error ? "text-red-500" : "text-indigo-500")
              : "top-3.5 text-sm text-gray-400"
            }
          `}>
            {label}
          </label>
        </div>
        {error && (
          <p className="mt-1 pl-1 text-red-500" style={{ fontSize: "0.72rem" }}>{error}</p>
        )}
      </div>
    );
  }
);
FloatingTextarea.displayName = "FloatingTextarea";

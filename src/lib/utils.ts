import { twMerge } from "tailwind-merge"

// ── Golden Rule: no dependency for what a few lines can build ──────────────
// Replaces `clsx` — conditional class name composition (~12 lines).
// Handles strings, numbers, arrays, and { className: boolean } objects.

type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>

function cx(...inputs: ClassValue[]): string {
  const out: string[] = []
  const walk = (val: ClassValue): void => {
    if (!val && val !== 0) return
    if (typeof val === "string" || typeof val === "number") {
      out.push(String(val))
    } else if (Array.isArray(val)) {
      val.forEach(walk)
    } else if (typeof val === "object") {
      for (const key in val) {
        if (val[key]) out.push(key)
      }
    }
  }
  inputs.forEach(walk)
  return out.join(" ")
}

// Replaces `class-variance-authority` — variant composition (~30 lines).
// Supports base + variants + defaultVariants + compoundVariants + className passthrough.

interface CvaConfig {
  variants?: Record<string, Record<string, string>>
  defaultVariants?: Record<string, string>
  compoundVariants?: Array<Record<string, string> & { class?: string }>
}

function cva<Base extends string>(base: Base, config?: CvaConfig) {
  // Props accept ANY value type (string, boolean, function, ReactNode, etc.)
  // because cva is used inside Button/Badge components that forward children,
  // onClick, disabled, style, and other non-string props. cva only reads the
  // variant keys (which ARE strings); everything else is ignored.
  return (props?: Record<string, unknown> & { className?: string }): string => {
    let classes: string = base
    const resolved: Record<string, string | undefined> = {}
    if (config?.variants) {
      for (const key in config.variants) {
        const selected = (props?.[key] as string | undefined) ?? config.defaultVariants?.[key]
        resolved[key] = selected
        const val = config.variants[key][selected as string]
        if (val) classes += " " + val
      }
    }
    if (config?.compoundVariants) {
      for (const cv of config.compoundVariants) {
        let match = true
        for (const key in cv) {
          if (key === "class") continue
          if (resolved[key] !== cv[key]) {
            match = false
            break
          }
        }
        if (match && cv.class) classes += " " + cv.class
      }
    }
    if (props?.className) classes += " " + props.className
    return classes
  }
}

// VariantProps type — extracts variant keys from a cva return type
// Uses `any` in the constraint so it matches any function that returns string,
// regardless of the props type (Record<string, unknown>, etc.).
type VariantProps<T extends (props?: any) => string> = T extends (
  props?: infer P,
) => string
  ? P
  : never

// ── Public API ─────────────────────────────────────────────────────────────

export { cx, cva, type VariantProps, type ClassValue }

/** Merge class names (replaces clsx) + resolve Tailwind conflicts (tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(cx(inputs))
}

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function classNames(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

/** 创建接口存 low|medium|high，种子/旧数据可能是 Low|Normal|High */
export type PriorityTier = "low" | "normal" | "high";

export function getPriorityTier(
  p: string | null | undefined
): PriorityTier | null {
  if (p == null || String(p).trim() === "") return null;
  const x = String(p).trim().toLowerCase();
  if (x === "low") return "low";
  if (x === "medium" || x === "normal") return "normal";
  if (x === "high") return "high";
  return null;
}

export function priorityTierLabel(tier: PriorityTier): "Low" | "Normal" | "High" {
  if (tier === "low") return "Low";
  if (tier === "high") return "High";
  return "Normal";
}
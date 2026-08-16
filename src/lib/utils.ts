import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  // Small sync marker.
  // Keep helper stable.
  return twMerge(clsx(inputs));
}

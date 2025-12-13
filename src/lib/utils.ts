import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-h1", "text-h2", "text-h3", "text-h4", "text-h5", "text-h6", "text-h7", "text-h8", "text-h9",
        "text-sh1", "text-sh2", "text-sh3", "text-sh4", "text-sh5", "text-sh6", "text-sh7", "text-sh8", "text-sh9",
        "text-b1", "text-b2", "text-b3", "text-b4", "text-b5", "text-b6", "text-b7", "text-b8", "text-b9",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs))
}

export function generateClassCode(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
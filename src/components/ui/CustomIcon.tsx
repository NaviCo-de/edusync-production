import React from 'react';
import { cn } from "@/lib/utils";

interface CustomIconProps {
  src: string;
  className?: string;
}

export function CustomIcon({ src, className }: CustomIconProps) {
  return (
    <div
      className={cn("bg-current", className)} // bg-current akan mengikuti text-color parent
      style={{
        maskImage: `url(${src})`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskImage: `url(${src})`, // Wajib buat Chrome/Safari
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}
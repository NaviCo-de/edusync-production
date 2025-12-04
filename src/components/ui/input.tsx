import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex h-10 w-full px-8 py-4",
  {
    variants: {
      variant: {
        auth: "border-input rounded-[20px] h-19 bg-addition-blue-30 border-none text-b6 text-addition-blue-80 font-bold",
        filled: "border-none bg-slate-100 focus-visible:ring-blue-500", // Style Custom kamu (Background abu, no border)
      },
    },
    defaultVariants: {
      variant: "auth",
    },
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  icon?: React.ReactNode; // Bisa nerima komponen Icon apa aja
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, icon, type, ...props }, ref) => {
    return (
      // 3. LOGIC WRAPPER OTOMATIS
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            inputVariants({ variant, className }),
            icon && "pr-10" // Kalau ada icon, otomatis tambah padding kanan biar gak nabrak
          )}
          ref={ref}
          {...props}
        />
        
        {/* Render Icon kalau ada props-nya */}
        {icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    )
  }
)

export { Input }

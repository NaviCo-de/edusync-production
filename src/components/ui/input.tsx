import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex h-19 w-full px-8 py-4 focus:outline-none transition-all duration-300",
  {
    variants: {
      variant: {
        auth: "rounded-[20px] bg-addition-blue-30 text-b6 placeholder:text-addition-blue-80 focus:placeholder:text-blue-base font-bold focus:text-blue-base focus:bg-white border-[3px] border-transparent focus:border-[#466BFF] focus:shadow-[0_0_20px_rgba(0,0,0,0.15)]",
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
      <div className="relative w-full group">
        <input
          type={type}
          className={cn(
            inputVariants({ variant, className }),
            icon && "pr-19" // Kalau ada icon, otomatis tambah padding kanan biar gak nabrak
          )}
          ref={ref}
          {...props}
        />
        
        {icon && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2 text-addition-blue-80 group-focus-within:text-blue-base">
            {icon}
          </div>
        )}
      </div>
    )
  }
)

export { Input }

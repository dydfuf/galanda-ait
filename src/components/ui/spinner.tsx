import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(
        "size-4 animate-spin text-info motion-reduce:animate-none motion-reduce:transform-none",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner }

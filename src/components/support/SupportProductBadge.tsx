import { cn } from "@/lib/utils";
import { SUPPORTED_PRODUCTS, type SupportProduct } from "@/lib/types/support";

const productConfig: Record<string, { label: string; className: string }> = {
  "streamline-edu": { label: "EDU", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  "streamline-corporate": { label: "Corporate", className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  "streamline-creator": { label: "Creator", className: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
  "horizon": { label: "Horizon", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  "mejay": { label: "MEJay", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

function getConfig(product: SupportProduct) {
  if (productConfig[product]) return productConfig[product];
  const found = SUPPORTED_PRODUCTS.find(p => p.value === product);
  return { label: found?.label || product, className: "bg-muted text-muted-foreground border-border" };
}

export function SupportProductBadge({ product }: { product: SupportProduct }) {
  const config = getConfig(product);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}

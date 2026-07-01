import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSelectedMonth } from "@/lib/selected-month";

export function MonthSelector() {
  const { label, next, prev } = useSelectedMonth();
  return (
    <div className="mb-6 inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1 animate-vm-in">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="px-3 text-sm text-foreground min-w-[9rem] text-center capitalize">{label}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

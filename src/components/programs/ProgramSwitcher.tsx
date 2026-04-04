// ---------------------------------------------------------------------------
// ProgramSwitcher — dropdown that lists all registered programs and lets the
// user switch the active one.  Also surfaces the "+ Add Program" button.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProgram } from "@/lib/programs/ProgramContext";
import { ProgramIntakeWizard } from "./ProgramIntakeWizard";
import { cn } from "@/lib/utils";

const ENV_COLORS: Record<string, string> = {
  production: "bg-emerald-500",
  staging: "bg-amber-500",
  dev: "bg-sky-500",
};

export function ProgramSwitcher() {
  const { activeProgram, programs, setActiveProgramId } = useProgram();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 px-2 py-1 h-auto text-sidebar-accent-foreground hover:bg-sidebar-accent/60"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full flex-shrink-0",
                  ENV_COLORS[activeProgram.environment] ?? "bg-muted-foreground"
                )}
              />
              <span className="max-w-[120px] truncate text-sm font-medium">
                {activeProgram.name}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-56">
            {programs.map((program) => (
              <DropdownMenuItem
                key={program.id}
                onClick={() => setActiveProgramId(program.id)}
                className="flex items-center gap-2"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    ENV_COLORS[program.environment] ?? "bg-muted-foreground"
                  )}
                />
                <span className="flex-1 truncate">{program.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {program.environment}
                </span>
                {program.id === activeProgram.id && (
                  <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-2 text-primary"
            >
              <Plus className="h-4 w-4" />
              <span>Add Program</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          title="Add Program"
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ProgramIntakeWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </>
  );
}

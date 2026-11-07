import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle2, Pencil, Star } from "lucide-react";
import { FIT_GAP_RESULT_CLASSES, FIT_GAP_RESULT_LABELS, LEVEL_LABELS, parseLevel } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { AssessorOverride, PortfolioSkill, SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
  skills?: PortfolioSkill[];
  overrides?: AssessorOverride[];
  onOverride?: (skill: PortfolioSkill, override?: AssessorOverride) => void;
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let suffix = "";
  if (comparison.result === "exceed") suffix = comparison.delta ? ` +${comparison.delta}` : "";
  else if (comparison.result === "gap") suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";

  const icon =
    comparison.result === "match" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> :
    comparison.result === "exceed" ? <Star className="h-3.5 w-3.5" aria-hidden /> :
    comparison.result === "gap" ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> :
    <span aria-hidden>—</span>;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon}
      <span>{label}{suffix}</span>
    </span>
  );
}

function formatWhen(value?: string) {
  if (!value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ComparisonTable({
  comparisons,
  skills = [],
  overrides = [],
  onOverride,
}: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const canOverride = !!onOverride && skills.length > 0;

  const findSkill = (comparison: SkillComparison) =>
    skills.find(
      (s) =>
        comparison.skill_id != null &&
        s.skill_id != null &&
        String(s.skill_id) === String(comparison.skill_id)
    ) || skills.find((s) => s.skill_label.toLowerCase() === comparison.skill_label.toLowerCase());

  const requiredLevel = (c: SkillComparison) => c.required_level ?? c.expected_level;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
              {canOverride && <th className="text-right px-4 py-2.5 font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => {
              const skill = findSkill(c);
              const override = skill
                ? overrides.find((o) => o.portfolio_skill_id === skill.id)
                : undefined;
              const isOverridden = !!override || c.is_override;
              const req = requiredLevel(c);

              return (
                <tr key={`${c.skill_label}-${i}`} className="border-b last:border-0">
                  <td className="px-4 py-2.5">{c.skill_label}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">
                    {req != null ? LEVEL_LABELS[req] ?? `L${req}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.candidate_level != null ? (
                      <div className="inline-flex flex-col items-center gap-1">
                        <span>
                          {LEVEL_LABELS[c.candidate_level] ?? `L${c.candidate_level}`}
                          {isOverridden && <Pencil className="inline-block h-3 w-3 text-muted-foreground ml-1 align-[-1px]" aria-label="Overridden" />}
                        </span>
                        {isOverridden && skill && (
                          <span className="text-[11px] text-muted-foreground">
                            AI {LEVEL_LABELS[parseLevel(skill.ai_level)]} / Assessor{" "}
                            {LEVEL_LABELS[override?.override_level ?? c.candidate_level ?? 0] ??
                              `L${override?.override_level ?? c.candidate_level}`}
                          </span>
                        )}
                        {isOverridden && override && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="cursor-default font-normal">
                                  Overridden
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs whitespace-normal">
                                <p>{override.assessor_notes}</p>
                                <p className="mt-1 text-xs opacity-80">
                                  By assessor {override.overridden_by ?? "?"} · {formatWhen(override.overridden_at)}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {isOverridden && !override && (
                          <Badge variant="secondary" className="font-normal">
                            Overridden
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                  {canOverride && (
                    <td className="px-4 py-2.5 text-right">
                      {skill ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOverride?.(skill, override)}
                        >
                          {override ? "Edit override" : "Override"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-sky-600" aria-hidden />
            Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        {(comparisons.some((c) => c.is_override) || overrides.length > 0) && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            human override applied
          </span>
        )}
      </div>
    </div>
  );
}

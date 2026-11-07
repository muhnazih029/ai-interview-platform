import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LevelRadio from "@/components/assessment/LevelRadio";
import LevelBadge from "./LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { CheckCircle2, Loader2, Pencil, SlidersHorizontal } from "lucide-react";
import { parseLevel } from "@/utils/constants";
import type { PortfolioSkill, AssessorOverride } from "@/types";

interface OverridePanelProps {
  skill: PortfolioSkill;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

const MIN_REASON_LENGTH = 10;

export default function OverridePanel({ skill, existingOverride, onSaved }: OverridePanelProps) {
  const [open, setOpen] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState(existingOverride?.override_level ?? parseLevel(skill.ai_level));
  const [notes, setNotes] = useState(existingOverride?.assessor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasOverride = !!existingOverride;
  const initialLevel = existingOverride?.override_level ?? parseLevel(skill.ai_level);
  const initialNotes = existingOverride?.assessor_notes ?? "";
  const reasonLength = notes.trim().length;
  const hasChanges = overrideLevel !== initialLevel || notes !== initialNotes;
  const canSave = hasChanges && reasonLength >= MIN_REASON_LENGTH && !saving;

  useEffect(() => {
    if (!open) return;
    setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
    setNotes(existingOverride?.assessor_notes ?? "");
    setSaveError(false);
  }, [open, skill, existingOverride]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await portfoliosApi.getOverride(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes.trim(),
      });
      onSaved(res.data.override);
      setOpen(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {hasOverride ? (
          <>
            <div className="flex items-center gap-1.5 text-sm">
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
              <span className="text-muted-foreground text-xs">AI</span>
              <span className="text-muted-foreground">→</span>
              <LevelBadge level={existingOverride!.override_level} size="sm" />
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Overridden
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit override
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Override rating
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Override rating</DialogTitle>
            <DialogDescription>Set your rating for {skill.skill_label}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>AI rating:</span>
              <LevelBadge level={parseLevel(skill.ai_level)} size="sm" />
            </div>

            <div className="space-y-2">
              <Label>Your rating</Label>
              <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`notes-${skill.id}`}>Reason</Label>
                <span
                  className={
                    reasonLength < MIN_REASON_LENGTH
                      ? "text-xs text-muted-foreground"
                      : "text-xs text-emerald-600"
                  }
                >
                  {reasonLength}/{MIN_REASON_LENGTH}
                </span>
              </div>
              <Textarea
                id={`notes-${skill.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Explain the evidence that supports this rating..."
              />
              <div className="min-h-4" aria-live="polite">
                {reasonLength > 0 && reasonLength < MIN_REASON_LENGTH ? (
                  <p className="text-xs text-muted-foreground">
                    Add at least {MIN_REASON_LENGTH - reasonLength} more characters.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="min-h-5" aria-live="polite">
              {saveError ? (
                <p className="text-sm text-destructive">Failed to save override. Please try again.</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

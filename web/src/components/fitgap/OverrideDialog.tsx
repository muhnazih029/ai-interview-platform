import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LevelRadio from "@/components/assessment/LevelRadio";
import { portfoliosApi } from "@/services/portfolios";
import { parseLevel } from "@/utils/constants";
import { Loader2 } from "lucide-react";
import type { AssessorOverride, PortfolioSkill } from "@/types";

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: PortfolioSkill | null;
  existingOverride?: AssessorOverride;
  onSaved: (override: AssessorOverride) => void;
}

const MIN_REASON_LENGTH = 10;

export default function OverrideDialog({
  open,
  onOpenChange,
  skill,
  existingOverride,
  onSaved,
}: OverrideDialogProps) {
  const [overrideLevel, setOverrideLevel] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !skill) return;
    setOverrideLevel(existingOverride?.override_level ?? parseLevel(skill.ai_level));
    setNotes(existingOverride?.assessor_notes ?? "");
    setError(null);
  }, [open, skill, existingOverride]);

  const initialLevel = skill ? (existingOverride?.override_level ?? parseLevel(skill.ai_level)) : 3;
  const initialNotes = existingOverride?.assessor_notes ?? "";
  const reasonLength = notes.trim().length;
  const hasChanges = overrideLevel !== initialLevel || notes !== initialNotes;
  const canSave = !!skill && hasChanges && reasonLength >= MIN_REASON_LENGTH && !saving;

  const handleSave = async () => {
    if (!skill || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await portfoliosApi.overrideSkill(skill.id, {
        override_level: overrideLevel,
        assessor_notes: notes.trim(),
      });
      onSaved(res.data.override);
      onOpenChange(false);
    } catch (e: any) {
      const message =
        e?.response?.data?.errors?.[0]?.title ||
        e?.response?.data?.data?.errors?.[0]?.title ||
        e?.message ||
        "Failed to save override.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Override assessor rating</DialogTitle>
          <DialogDescription>
            {skill ? `Set the assessor level for ${skill.skill_label} and explain why.` : ""}
          </DialogDescription>
        </DialogHeader>

        {skill && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your rating</Label>
              <LevelRadio value={overrideLevel} onChange={setOverrideLevel} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="override-reason">Reason</Label>
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
                id="override-reason"
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
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

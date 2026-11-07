import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import OverrideDialog from "@/components/fitgap/OverrideDialog";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type {
  AssessorOverride,
  FitGapReport,
  FitGapStatus,
  Portfolio,
  PortfolioSkill,
} from "@/types";

const INITIAL_POLL_MS = 2000;
const MAX_POLL_MS = 60000;

function nextPollDelay(current: number) {
  return Math.min(MAX_POLL_MS, Math.max(INITIAL_POLL_MS, Math.floor(current * 2)));
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [status, setStatus] = useState<FitGapStatus | "loading" | "failed">("loading");
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [pollDelay, setPollDelay] = useState(INITIAL_POLL_MS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSkill, setDialogSkill] = useState<PortfolioSkill | null>(null);
  const [dialogOverride, setDialogOverride] = useState<AssessorOverride | undefined>(undefined);

  const missingTriggered = useRef(false);
  const pollTimer = useRef<number | null>(null);

  const loadPortfolio = useCallback(async () => {
    if (!sessionId) return null;
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data?.portfolio) {
      setPortfolio(data.portfolio);
      return data.portfolio as Portfolio;
    }
    if (data?.status === "failed") {
      setStatus("failed");
    }
    return null;
  }, [sessionId]);

  const triggerGeneration = useCallback(
    async (targetPortfolio: Portfolio) => {
      if (!vacancyId) return;
      try {
        await portfoliosApi.triggerFitGap(targetPortfolio.id, Number(vacancyId));
      } catch {
      }
    },
    [vacancyId]
  );

  const fetchReport = useCallback(
    async (targetPortfolio?: Portfolio | null) => {
      const p = targetPortfolio ?? portfolio;
      if (!p || !vacancyId) return;
      try {
        const res = await portfoliosApi.getFitGap(p.id, Number(vacancyId));
        const data = res.data;
        const nextStatus = data.status ?? (data.report ? "ready" : "missing");

        setStatus(nextStatus);
        setStale(!!data.stale);
        setReport(data.report ?? null);

        if (nextStatus === "missing" && !missingTriggered.current) {
          missingTriggered.current = true;
          setStatus("pending");
          await triggerGeneration(p);
          setPollDelay(INITIAL_POLL_MS);
          return;
        }

        if (nextStatus === "pending") {
          setPollDelay((d) => nextPollDelay(d));
        } else {
          setPollDelay(INITIAL_POLL_MS);
        }
      } catch (e: any) {
        if (e?.response?.status === 404) {
          setStatus("failed");
        } else if (status !== "ready") {
          setStatus("failed");
        }
      }
    },
    [portfolio, vacancyId, triggerGeneration, status]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await loadPortfolio();
        if (!active) return;
        if (p) {
          await fetchReport(p);
        } else if (status === "loading") {
          setStatus("failed");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadPortfolio, fetchReport]);

  useEffect(() => {
    if (pollTimer.current) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    if (!portfolio || (status !== "pending" && !(status === "ready" && stale))) return;

    pollTimer.current = window.setTimeout(() => {
      fetchReport();
    }, pollDelay);

    return () => {
      if (pollTimer.current) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [portfolio, status, stale, pollDelay, fetchReport]);

  const handleRegenerate = async () => {
    if (!portfolio || !vacancyId) return;
    setRegenerating(true);
    missingTriggered.current = true;
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setStatus("pending");
      setPollDelay(INITIAL_POLL_MS);
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || !vacancyId) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const openOverride = (skill: PortfolioSkill, override?: AssessorOverride) => {
    setDialogSkill(skill);
    setDialogOverride(override);
    setDialogOpen(true);
  };

  const handleOverrideSaved = async (saved: AssessorOverride) => {
    if (!portfolio) return;
    const existing = portfolio.overrides || [];
    const nextOverrides = existing.some((o) => o.portfolio_skill_id === saved.portfolio_skill_id)
      ? existing.map((o) => (o.portfolio_skill_id === saved.portfolio_skill_id ? saved : o))
      : [...existing, saved];
    setPortfolio({ ...portfolio, overrides: nextOverrides });
    missingTriggered.current = true;
    await fetchReport({ ...portfolio, overrides: nextOverrides });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const showGenerating = status === "pending" || status === "loading";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
            {status === "ready" && stale && (
              <span className="text-xs rounded bg-amber-100 text-amber-800 px-2 py-0.5">
                Refreshing
              </span>
            )}
          </div>
        </div>

        {portfolio && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || status === "pending"}
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Regenerate
            </Button>
            {report && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {status === "missing" && (
        <div className="border rounded-lg p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No fit/gap report for this vacancy yet.</p>
        </div>
      )}

      {showGenerating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
        </div>
      )}

      {status === "failed" && !report && (
        <div className="border rounded-lg p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Could not load the fit/gap report.</p>
          <Button variant="outline" size="sm" onClick={() => fetchReport()}>
            Try again
          </Button>
        </div>
      )}

      {report && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable
                comparisons={report.skill_comparisons}
                skills={portfolio?.skills}
                overrides={portfolio?.overrides}
                onOverride={openOverride}
              />
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-xs text-muted-foreground">
                          — Not required for this role, may be additive.
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <OverrideDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        skill={dialogSkill}
        existingOverride={dialogOverride}
        onSaved={handleOverrideSaved}
      />
    </div>
  );
}

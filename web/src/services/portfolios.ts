import api from "./api";
import type { AssessorOverride, FitGapStatusResponse } from "@/types";

export const portfoliosApi = {
  overrideSkill: (
    portfolioSkillId: number,
    data: { override_level: number; assessor_notes: string }
  ) =>
    api.post<{ override: AssessorOverride; history_count?: number }>(
      `/portfolio_skills/${portfolioSkillId}/override`,
      { override: data }
    ),

  getOverride: (portfolioSkillId: number, data: { override_level: number; assessor_notes: string }) =>
    api.post<{ override: AssessorOverride; history_count?: number }>(
      `/portfolio_skills/${portfolioSkillId}/override`,
      { override: data }
    ),

  triggerFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<FitGapStatusResponse>(`/portfolios/${portfolioId}/fitgap`, {
      fitgap: { vacancy_id: vacancyId },
    }),

  getFitGap: (portfolioId: number, vacancyId: number) =>
    api.get<FitGapStatusResponse>(`/portfolios/${portfolioId}/fitgap/${vacancyId}`),

  regenerateFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<FitGapStatusResponse>(`/portfolios/${portfolioId}/regenerate_fitgap`, {
      vacancy_id: vacancyId,
    }),

  exportPortfolio: (portfolioId: number, format: "pdf" | "json", vacancyId?: number) =>
    api.get(`/portfolios/${portfolioId}/export`, {
      params: { format, ...(vacancyId ? { vacancy_id: vacancyId } : {}) },
      responseType: format === "pdf" ? "blob" : "json",
    }),
};

# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # POST /api/v1/portfolio-skills/:id/override
      def override
        result = AssessorOverrides::Record.new(
          skill: @portfolio_skill,
          override_level: override_params[:override_level],
          reason: override_params[:assessor_notes],
          actor: current_user
        ).call

        regenerate_stale_fitgap_reports

        json_response(
          { override: override_json(result.override), history_count: result.history_count },
          result.created ? :created : :ok
        )
      rescue AssessorOverrides::Record::InvalidReason, ActiveRecord::RecordInvalid => e
        json_error(e.message, :unprocessable_entity)
      end

      private

      def regenerate_stale_fitgap_reports
        portfolio = @portfolio_skill.portfolio
        FitGapReport.where(portfolio_id: portfolio.id).find_each do |report|
          FitGap::Enqueuer.call(portfolio: portfolio, vacancy_id: report.vacancy_id)
        end
      end

      def set_portfolio_skill
        @portfolio_skill = PortfolioSkill
          .joins(:portfolio)
          .where(portfolios: { tenant_id: Current.tenant_id })
          .find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
      end

      def override_params
        params.require(:override).permit(:override_level, :assessor_notes)
      end

      def override_json(override)
        {
          id:                 override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level:           override.ai_level,
          override_level:     override.override_level,
          assessor_notes:     override.assessor_notes,
          overridden_by:      override.overridden_by,
          overridden_at:      override.overridden_at
        }
      end
    end
  end
end

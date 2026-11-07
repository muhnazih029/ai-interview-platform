# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id, expected_version = nil)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    existing = FitGapReport.find_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)
    if expected_version && existing && existing.computed_overrides_version.to_i > expected_version.to_i
      Rails.logger.info(
        "[N13] Skipping stale fit/gap job portfolio=#{portfolio_id} vacancy=#{vacancy_id} " \
        "expected=#{expected_version} current=#{existing.computed_overrides_version}"
      )
      return
    end

    FitGap::Engine.new(
      portfolio: portfolio,
      vacancy: vacancy,
      computed_overrides_version: portfolio.overrides_version.to_i
    ).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end

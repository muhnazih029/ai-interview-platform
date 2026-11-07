# frozen_string_literal: true

module FitGap
  class Enqueuer
    TTL = 2.minutes

    def self.call(portfolio:, vacancy_id:)
      new(portfolio: portfolio, vacancy_id: vacancy_id).call
    end

    def initialize(portfolio:, vacancy_id:)
      @portfolio = portfolio
      @vacancy_id = vacancy_id.to_i
    end

    def call
      acquired = Rails.cache.write(cache_key, 1, unless_exist: true, expires_in: TTL)
      return false unless acquired

      FitGapGeneratorWorker.perform_async(@portfolio.id, @vacancy_id, @portfolio.overrides_version.to_i)
      true
    rescue StandardError => e
      Rails.cache.delete(cache_key)
      Rails.logger.error(
        "[FitGap::Enqueuer] enqueue failed portfolio=#{@portfolio.id} vacancy=#{@vacancy_id}: #{e.class}: #{e.message}"
      )
      raise
    end

    def cache_key
      "fitgap:enqueue:#{@portfolio.id}:#{@vacancy_id}"
    end
  end
end

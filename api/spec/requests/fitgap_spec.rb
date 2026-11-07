# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/testing'

RSpec.describe 'Fit/gap generation', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, role: 'admin') }

  let!(:assessment) do
    within_tenant(organization) do
      Assessment.create!(name: 'Backend assessment', time_limit_min: 30, created_by: user.id)
    end
  end

  let!(:session_record) do
    Session.create!(
      assessment: assessment,
      tenant_id: organization.id,
      candidate_id: user.id
    )
  end

  let!(:portfolio) do
    Portfolio.create!(session: session_record, generation_status: 'complete', overrides_version: 0)
  end

  let!(:vacancy) do
    within_tenant(organization) do
      Vacancy.create!(role_title: 'Backend Engineer', created_by: user.id)
    end
  end

  def headers
    auth_headers(token_for(user, organization.scheme))
  end

  before do
    Sidekiq::Testing.fake!
    Sidekiq::Worker.clear_all
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    it 'keeps the existing report until a new result is computed' do
      report = FitGapReport.create!(
        portfolio: portfolio,
        vacancy: vacancy,
        skill_comparisons: [{ 'skill_label' => 'SQL', 'result' => 'match' }],
        computed_overrides_version: 0
      )

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers,
           as: :json

      expect(response).to have_http_status(:accepted)
      expect(FitGapReport.find_by(id: report.id)).to be_present
    end

    it 'enqueues only one job within the dedupe window' do
      previous_cache = Rails.cache
      Rails.cache = ActiveSupport::Cache::MemoryStore.new

      FitGapReport.create!(
        portfolio: portfolio,
        vacancy: vacancy,
        skill_comparisons: [{ 'skill_label' => 'SQL', 'result' => 'match' }],
        computed_overrides_version: 0
      )

      2.times do
        post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
             params: { vacancy_id: vacancy.id },
             headers: headers,
             as: :json
      end

      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    ensure
      Rails.cache = previous_cache
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'returns missing when no report exists and no job is pending' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('missing')
      expect(body['report']).to be_nil
    end

    it 'returns pending when generation was recently enqueued' do
      previous_cache = Rails.cache
      Rails.cache = ActiveSupport::Cache::MemoryStore.new
      Rails.cache.write("fitgap:enqueue:#{portfolio.id}:#{vacancy.id}", 1, expires_in: 2.minutes)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('pending')
    ensure
      Rails.cache = previous_cache
    end

    it 'returns ready with the report' do
      FitGapReport.create!(
        portfolio: portfolio,
        vacancy: vacancy,
        skill_comparisons: [{ 'skill_label' => 'SQL', 'result' => 'match' }],
        computed_overrides_version: 0
      )

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('ready')
      expect(body['stale']).to eq(false)
      expect(body.dig('report', 'portfolio_id')).to eq(portfolio.id)
    end
  end

  describe 'FitGapGeneratorWorker' do
    it 'does not overwrite a newer report with a stale result' do
      portfolio.update!(overrides_version: 2)
      report = FitGapReport.create!(
        portfolio: portfolio,
        vacancy: vacancy,
        skill_comparisons: [{ 'skill_label' => 'SQL', 'result' => 'match', 'computed' => 'new' }],
        computed_overrides_version: 2
      )

      FitGapGeneratorWorker.new.perform(portfolio.id, vacancy.id, 1)

      report.reload
      expect(report.computed_overrides_version).to eq(2)
      expect(report.skill_comparisons.first['computed']).to eq('new')
    end
  end
end

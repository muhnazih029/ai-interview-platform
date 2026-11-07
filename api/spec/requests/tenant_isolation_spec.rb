# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio tenant isolation', type: :request do
  let(:org_a) { create(:organization) }
  let(:org_b) { create(:organization) }
  let(:user_a) { create(:user) }
  let(:user_b) { create(:user) }

  let!(:portfolio_a) do
    within_tenant(org_a) do
      assessment = Assessment.create!(
        name: 'Backend assessment',
        time_limit_min: 30,
        created_by: user_a.id
      )
      session = Session.create!(
        assessment: assessment,
        tenant_id: org_a.id,
        candidate_id: user_a.id
      )
      Portfolio.create!(session: session, generation_status: 'complete')
    end
  end

  let!(:vacancy_a) do
    within_tenant(org_a) do
      Vacancy.create!(role_title: 'Backend Engineer', created_by: user_a.id)
    end
  end

  let!(:report_a) do
    FitGapReport.create!(
      portfolio: portfolio_a,
      vacancy: vacancy_a,
      skill_comparisons: [
        { 'skill_label' => 'SQL', 'required_level' => 3, 'candidate_level' => 3, 'result' => 'match' }
      ]
    )
  end

  let!(:skill_a) do
    PortfolioSkill.create!(
      portfolio: portfolio_a,
      skill_label: 'SQL',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Writes correct joins and explains query plans.'
    )
  end

  def get_fitgap(portfolio, vacancy, org, user)
    token = token_for(user, org.scheme)
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}",
        headers: auth_headers(token)
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'returns the report to a user in the same organization' do
      get_fitgap(portfolio_a, vacancy_a, org_a, user_a)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('report', 'portfolio_id')).to eq(portfolio_a.id)
    end

    it 'does not expose the report to a user in another organization' do
      get_fitgap(portfolio_a, vacancy_a, org_b, user_b)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'does not let a user in another organization override the skill' do
      token = token_for(user_b, org_b.scheme)

      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Reviewed the transcript evidence again.' } },
           headers: auth_headers(token),
           as: :json

      expect(response).to have_http_status(:not_found)
      expect(AssessorOverride.where(portfolio_skill_id: skill_a.id)).to be_empty
    end
  end
end

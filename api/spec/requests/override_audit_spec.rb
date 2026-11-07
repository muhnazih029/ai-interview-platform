# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio skill override', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, role: 'admin') }

  let!(:skill) do
    within_tenant(organization) do
      assessment = Assessment.create!(
        name: 'Backend assessment',
        time_limit_min: 30,
        created_by: user.id
      )
      session = Session.create!(
        assessment: assessment,
        tenant_id: organization.id,
        candidate_id: user.id
      )
      portfolio = Portfolio.create!(session: session, generation_status: 'complete')
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_label: 'SQL',
        ai_level: 2,
        ai_confidence: 'high',
        competency_summary: 'Can write basic joins.'
      )
    end
  end

  def post_override(level:, notes:)
    token = token_for(user, organization.scheme)
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: level, assessor_notes: notes } },
         headers: auth_headers(token),
         as: :json
  end

  it 'rejects an override without a reason' do
    post_override(level: 4, notes: '')

    expect(response).to have_http_status(:unprocessable_entity)
    expect(AssessorOverride.where(portfolio_skill_id: skill.id)).to be_empty
  end

  it 'rejects a reason shorter than 10 characters' do
    post_override(level: 4, notes: 'too short')

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'records the override and an append-only version' do
    post_override(level: 4, notes: 'Candidate explained query planning and trade-offs clearly in the transcript.')

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    expect(body.dig('override', 'override_level')).to eq(4)
    expect(body['history_count']).to eq(1)

    versions = AssessorOverrideVersion.where(portfolio_skill_id: skill.id).order(:version)
    expect(versions.count).to eq(1)
    expect(versions.first).to have_attributes(
      version: 1,
      ai_level: 2,
      override_level: 4,
      actor_id: user.id,
      actor_role: 'admin'
    )
    expect(versions.first.reason).to include('query planning')
  end

  it 'keeps prior versions when the override changes again' do
    post_override(level: 4, notes: 'Stronger evidence than the AI summary suggested.')
    post_override(level: 3, notes: 'Second review: evidence supports solid but not advanced depth.')

    expect(response).to have_http_status(:ok)
    versions = AssessorOverrideVersion.where(portfolio_skill_id: skill.id).order(:version)
    expect(versions.map(&:version)).to eq([1, 2])
    expect(versions.map(&:override_level)).to eq([4, 3])
    expect(AssessorOverride.where(portfolio_skill_id: skill.id).count).to eq(1)
    expect(AssessorOverride.find_by(portfolio_skill_id: skill.id).override_level).to eq(3)
  end
end

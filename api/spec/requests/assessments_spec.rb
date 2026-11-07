# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }

  describe 'GET /api/v1/assessments' do
    context 'without a token' do
      it 'rejects an anonymous request for the missing tenant before it checks the token' do
        get '/api/v1/assessments'

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'with a valid token' do
      it 'returns an empty list for a tenant that has no assessments yet' do
        token = token_for(user, organization.scheme)

        get '/api/v1/assessments', headers: auth_headers(token)

        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)['assessments']).to eq([])
      end
    end

    context 'with a token whose scheme matches no organization' do
      it 'refuses the request instead of falling back to a default tenant' do
        token = token_for(user, 'no-such-tenant')

        get '/api/v1/assessments', headers: auth_headers(token)

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'with a token signed by a different secret' do
      it 'does not trust the scheme claim' do
        forged = JWT.encode(
          { user_id: user.id, role: user.role, scheme: organization.scheme },
          'wrong-secret',
          'HS256'
        )

        get '/api/v1/assessments', headers: auth_headers(forged)

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end

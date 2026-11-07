# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Health', type: :request do
  describe 'GET /api/v1/health' do
    it 'reports ok without authentication or a resolved tenant' do
      get '/api/v1/health'

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq('status' => 'ok')
    end
  end
end

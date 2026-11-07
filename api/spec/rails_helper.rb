# frozen_string_literal: true

require 'spec_helper'

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'

# Loads db/schema.rb into a fresh database, and reloads it when a migration
# has been added since the last run.
ActiveRecord::Migration.maintain_test_schema!

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |file| require file }

RSpec.configure do |config|
  # Each example runs in a rolled-back transaction, so examples cannot see
  # each other's rows and no table truncation is needed between examples.
  config.use_transactional_fixtures = true

  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  # factory_bot_rails wires this up for ActiveSupport test cases only, so
  # request specs need it explicitly to use create(:factory).
  config.include FactoryBot::Syntax::Methods
  config.include AuthHelpers, type: :request

  # Integration tests default to www.example.com, which can trip host checks.
  # Pin to localhost so request specs exercise the app, not the host allowlist.
  config.before(:each, type: :request) { host! 'localhost' }

  # Current stores per-request globals in RequestStore. Clearing it after every
  # example stops a tenant or user set in one spec leaking into the next.
  config.after do
    Current.clear
  end
end

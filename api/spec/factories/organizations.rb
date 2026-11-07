# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:scheme) { |n| "tenant-#{n}" }
    name { "#{scheme.titleize} Organization" }
    identifier { scheme }
    host { "#{scheme}.example.test" }
  end
end

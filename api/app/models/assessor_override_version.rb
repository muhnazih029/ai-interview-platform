# frozen_string_literal: true

class AssessorOverrideVersion < ApplicationRecord
  belongs_to :portfolio_skill

  validates :tenant_id, :version, :ai_level, :override_level, :reason, :actor_id, :actor_role,
            presence: true
  validates :ai_level, :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :version, numericality: { only_integer: true, greater_than: 0 }

  before_update :prevent_mutation
  before_destroy :prevent_mutation

  private

  def prevent_mutation
    raise ActiveRecord::ReadOnlyRecord, 'override history is append-only'
  end
end

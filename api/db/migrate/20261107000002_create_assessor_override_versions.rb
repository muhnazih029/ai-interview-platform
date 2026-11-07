# frozen_string_literal: true

class CreateAssessorOverrideVersions < ActiveRecord::Migration[7.0]
  def change
    create_table :assessor_override_versions do |t|
      t.references :portfolio_skill, null: false, foreign_key: true, index: false
      t.bigint :tenant_id, null: false
      t.integer :version, null: false
      t.integer :ai_level, null: false
      t.integer :override_level, null: false
      t.text :reason, null: false
      t.bigint :actor_id, null: false
      t.string :actor_role, null: false
      t.datetime :created_at, null: false, default: -> { 'CURRENT_TIMESTAMP' }

      t.index %i[portfolio_skill_id version], unique: true, name: 'idx_override_versions_on_skill_and_version'
      t.index :portfolio_skill_id
      t.index :tenant_id
    end

    add_column :portfolios, :overrides_version, :integer, null: false, default: 0
  end
end

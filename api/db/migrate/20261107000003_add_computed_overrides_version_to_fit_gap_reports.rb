# frozen_string_literal: true

class AddComputedOverridesVersionToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    add_column :fit_gap_reports, :computed_overrides_version, :integer, null: false, default: 0
  end
end

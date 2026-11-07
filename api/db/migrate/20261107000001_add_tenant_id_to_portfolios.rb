# frozen_string_literal: true

class AddTenantIdToPortfolios < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :tenant_id, :bigint

    execute <<~SQL
      UPDATE portfolios
      SET tenant_id = sessions.tenant_id
      FROM sessions
      WHERE sessions.id = portfolios.session_id
        AND portfolios.tenant_id IS NULL
    SQL

    change_column_null :portfolios, :tenant_id, false
    add_index :portfolios, :tenant_id
  end

  def down
    remove_index :portfolios, :tenant_id
    remove_column :portfolios, :tenant_id
  end
end

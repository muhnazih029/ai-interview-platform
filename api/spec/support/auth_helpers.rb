# frozen_string_literal: true

# Specs authenticate the way the application does: a signed JWT whose `scheme`
# claim selects the tenant. Building real tokens keeps TenantResolverMiddleware
# and AuthorizeApiRequest under test instead of stubbing them out, so a change
# to either one shows up as a failing spec.
module AuthHelpers
  def token_for(user, scheme)
    JsonWebToken.encode(user_id: user.id, role: user.role, scheme: scheme)
  end

  def auth_headers(token)
    { 'Authorization' => "Bearer #{token}" }
  end

  # Tenant-scoped models read Current.tenant_id. Specs that build those records
  # directly need the same context a request would have set.
  def within_tenant(organization)
    Current.using(tenant_id: organization.id, organization: organization) { yield }
  end
end

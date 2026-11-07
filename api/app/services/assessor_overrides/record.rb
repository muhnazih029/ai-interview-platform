# frozen_string_literal: true

module AssessorOverrides
  class Record
    MIN_REASON_LENGTH = 10

    Result = Struct.new(:override, :history_count, :created, keyword_init: true)

    class InvalidReason < StandardError; end

    def initialize(skill:, override_level:, reason:, actor:)
      @skill = skill
      @override_level = override_level
      @reason = reason.to_s.strip
      @actor = actor
    end

    def call
      raise InvalidReason, reason_error if @reason.length < MIN_REASON_LENGTH

      PortfolioSkill.transaction do
        @skill.lock!
        portfolio = @skill.portfolio
        existing = @skill.assessor_override
        created = existing.nil?

        override = if existing
                     existing.assign_attributes(
                       override_level: @override_level,
                       assessor_notes: @reason,
                       overridden_by: @actor.id,
                       overridden_at: Time.current
                     )
                     existing
                   else
                     @skill.build_assessor_override(
                       ai_level: @skill.ai_level,
                       override_level: @override_level,
                       assessor_notes: @reason,
                       overridden_by: @actor.id,
                       overridden_at: Time.current
                     )
                   end

        override.save!

        version = next_version
        AssessorOverrideVersion.create!(
          portfolio_skill_id: @skill.id,
          tenant_id: portfolio.tenant_id,
          version: version,
          ai_level: @skill.ai_level,
          override_level: @override_level.to_i,
          reason: @reason,
          actor_id: @actor.id,
          actor_role: @actor.role.to_s
        )

        Result.new(override: override, history_count: version, created: created)
      end
    end

    private

    def next_version
      AssessorOverrideVersion.where(portfolio_skill_id: @skill.id).maximum(:version).to_i + 1
    end

    def reason_error
      "Assessor notes must be at least #{MIN_REASON_LENGTH} characters"
    end
  end
end

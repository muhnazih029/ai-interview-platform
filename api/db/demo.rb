# frozen_string_literal: true

require 'securerandom'

puts '== Demo data (idempotent where practical) =='

org_a = Organization.find_or_create_by!(scheme: 'test-corp') do |o|
  o.name = 'Test Corp'
  o.identifier = 'test-corp'
  o.host = 'test-corp.example.test'
end

org_b = Organization.find_or_create_by!(scheme: 'other-corp') do |o|
  o.name = 'Other Corp'
  o.identifier = 'other-corp'
  o.host = 'other-corp.example.test'
end

user_a = User.find_or_create_by!(email: 'assessor@example.com') do |u|
  u.password = 'password123'
  u.role = 'admin'
end

user_b = User.find_or_create_by!(email: 'assessor.b@example.com') do |u|
  u.password = 'password123'
  u.role = 'admin'
end

def seed_tenant(org:, user:, label:)
  Current.tenant_id = org.id
  Current.user = user
  Current.organization = org if Current.respond_to?(:organization=)

  begin
    vacancy = Vacancy.find_or_initialize_by(role_title: 'Senior Backend Engineer', tenant_id: org.id)
    vacancy.created_by = user.id
    vacancy.culture_dimensions = 'Clear communication, ownership, pragmatic engineering.'
    vacancy.competency_expectations = 'Designs reliable APIs, reasons about data, and collaborates across teams.'
    vacancy.save!

    desired_skills = [
      { skill_id: 'SQL', skill_label: 'SQL', expected_level: 4 },
      { skill_id: 'API', skill_label: 'API Design', expected_level: 4 },
      { skill_id: 'SYS', skill_label: 'System Design', expected_level: 3 },
      { skill_id: 'TEST', skill_label: 'Testing', expected_level: 3 },
      { skill_id: 'COMM', skill_label: 'Communication', expected_level: 3 }
    ]
    desired_skills.each do |attrs|
      VacancySkill.find_or_create_by!(vacancy: vacancy, skill_label: attrs[:skill_label]) do |s|
        s.skill_id = attrs[:skill_id]
        s.expected_level = attrs[:expected_level]
      end
    end

    assessment = Assessment.find_or_create_by!(name: "Demo Assessment #{label}") do |a|
      a.time_limit_min = 30
      a.created_by = user.id
    end

    session = Session.find_or_initialize_by(assessment: assessment, tenant_id: org.id)
    if session.new_record?
      session.candidate_id = user.id
      session.candidate_name = "Candidate #{label}"
      session.invite_token = SecureRandom.hex(16)
      session.status = 'ended'
      session.started_at = 1.hour.ago
      session.ended_at = 40.minutes.ago
      session.duration_seconds = 1200
    end
    session.save!

    portfolio = Portfolio.find_or_initialize_by(session: session)
    portfolio.tenant_id = org.id
    portfolio.generation_status = 'complete'
    portfolio.generated_at ||= Time.current
    portfolio.overrides_version ||= 0
    portfolio.save!

    skill_rows = [
      { skill_label: 'SQL', ai_level: 3, ai_confidence: 'high', summary: 'Writes correct joins and explains trade-offs.' },
      { skill_label: 'API Design', ai_level: 4, ai_confidence: 'high', summary: 'Designs clear REST contracts and error handling.' },
      { skill_label: 'System Design', ai_level: 2, ai_confidence: 'medium', summary: 'Understands components but needs depth on scaling.' },
      { skill_label: 'Testing', ai_level: 3, ai_confidence: 'medium', summary: 'Covers happy paths; can improve failure-case tests.' },
      { skill_label: 'Communication', ai_level: 4, ai_confidence: 'high', summary: 'Explains decisions clearly with evidence.' }
    ]

    skill_rows.each_with_index do |row, i|
      skill = PortfolioSkill.find_or_initialize_by(portfolio: portfolio, skill_label: row[:skill_label])
      skill.skill_id = desired_skills[i][:skill_id]
      skill.is_discovered = false
      skill.ai_level = row[:ai_level]
      skill.ai_confidence = row[:ai_confidence]
      skill.evidence = ['Demo evidence from transcript.']
      skill.competency_summary = row[:summary]
      skill.save!
    end

    report = FitGapReport.find_or_initialize_by(portfolio: portfolio, vacancy: vacancy)
    report.skill_comparisons = [
      { 'skill_id' => 'SQL', 'skill_label' => 'SQL', 'candidate_level' => 3, 'expected_level' => 4, 'result' => 'gap', 'delta' => -1, 'confidence' => 'high' },
      { 'skill_id' => 'API', 'skill_label' => 'API Design', 'candidate_level' => 4, 'expected_level' => 4, 'result' => 'match', 'delta' => 0, 'confidence' => 'high' },
      { 'skill_id' => 'SYS', 'skill_label' => 'System Design', 'candidate_level' => 2, 'expected_level' => 3, 'result' => 'gap', 'delta' => -1, 'confidence' => 'medium' },
      { 'skill_id' => 'TEST', 'skill_label' => 'Testing', 'candidate_level' => 3, 'expected_level' => 3, 'result' => 'match', 'delta' => 0, 'confidence' => 'medium' },
      { 'skill_id' => 'COMM', 'skill_label' => 'Communication', 'candidate_level' => 4, 'expected_level' => 3, 'result' => 'exceed', 'delta' => 1, 'confidence' => 'high' }
    ]
    report.culture_narrative = 'Candidate shows clear communication and pragmatic reasoning.'
    report.overall_narrative = 'Mixed fit: strong communication and API design, with gaps in SQL depth and system design.'
    report.generated_at ||= Time.current
    report.computed_overrides_version = portfolio.overrides_version.to_i
    report.save!

    { org: org, user: user, vacancy: vacancy, assessment: assessment, session: session, portfolio: portfolio, report: report }
  ensure
    Current.clear
  end
end

result_a = seed_tenant(org: org_a, user: user_a, label: 'A')
result_b = seed_tenant(org: org_b, user: user_b, label: 'B')

token_a = JsonWebToken.encode({ user_id: user_a.id, role: user_a.role, scheme: org_a.scheme })
token_b = JsonWebToken.encode({ user_id: user_b.id, role: user_b.role, scheme: org_b.scheme })

puts
[result_a, result_b].each do |r|
  puts "-- #{r[:org].scheme} --"
  puts "org_id=#{r[:org].id} user=#{r[:user].email}"
  puts "vacancy_id=#{r[:vacancy].id} assessment_id=#{r[:assessment].id} session_id=#{r[:session].id}"
  puts "portfolio_id=#{r[:portfolio].id} report_id=#{r[:report].id}"
end

puts
puts "TOKEN_A (#{org_a.scheme})=#{token_a}"
puts "TOKEN_B (#{org_b.scheme})=#{token_b}"
puts
puts 'Cross-tenant check example:'
puts "curl -s -o /dev/null -w '%{http_code}' -H \"Authorization: Bearer <TOKEN_B>\" http://localhost:3001/api/v1/portfolios/#{result_a[:portfolio].id}/fitgap/#{result_a[:vacancy].id}"
puts 'Expected: 404'
puts '== done =='

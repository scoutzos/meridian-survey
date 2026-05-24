-- =============================================================================
-- Update settled managing-member decision.
--
-- The tiebreaker survey no longer needs to ask who the Co-Managing Members are.
-- The current settled structure is Courtney, Aaliyah, and Odessa.
-- =============================================================================

update decisions
set
  final_answer = 'Three Co-Managing Members: Courtney, Aaliyah, and Odessa. No extra compensation.',
  notes = 'Confirmed after recalculating for the current four-member group.',
  status = 'confirmed',
  updated_at = now()
where id = 'd10'
  and topic = 'Managing Members';

import {
  PREFERENCE_LEARNING_VERSION,
  LearnedPreferencesPayloadSchema,
  type FeedbackEventType,
  type LearnedPreferencesPayload,
  type RejectionReason,
} from '@aijh/contracts';

export type FeedbackEventForLearning = {
  id: string;
  type: FeedbackEventType;
  rejectionReasons: RejectionReason[] | string[];
  canonicalJobId: string;
  jobTitle?: string | null;
  jobWorkMode?: 'onsite' | 'hybrid' | 'remote' | 'unknown' | null;
  jobDepartments?: string[];
  jobDescriptionText?: string | null;
};

/**
 * Deterministic preference learning from auditable feedback.
 * Never mutates CV facts. Never infers sensitive characteristics.
 * Explicit profile preferences remain authoritative at match time.
 */
export function computeLearnedPreferences(
  events: FeedbackEventForLearning[],
  now = new Date(),
): LearnedPreferencesPayload {
  const preferredJobTitles = new Set<string>();
  const preferredIndustries = new Set<string>();
  const excludedIndustries = new Set<string>();
  const preferredWorkModes = new Set<
    'onsite' | 'hybrid' | 'remote' | 'unknown'
  >();
  const demotedWorkModes = new Set<
    'onsite' | 'hybrid' | 'remote' | 'unknown'
  >();
  const inferences: LearnedPreferencesPayload['inferences'] = [];

  for (const event of events) {
    const reasons = event.rejectionReasons as RejectionReason[];

    if (event.type === 'saved' || event.type === 'interested') {
      if (event.jobTitle?.trim()) {
        preferredJobTitles.add(event.jobTitle.trim());
        inferences.push({
          ruleId: 'boost_title_on_interest',
          fromEventIds: [event.id],
          message: `Interested/saved listing titled "${event.jobTitle.trim()}" soft-boosts preferred titles.`,
          rejectionReasons: [],
        });
      }
      if (event.jobWorkMode && event.jobWorkMode !== 'unknown') {
        preferredWorkModes.add(event.jobWorkMode);
        inferences.push({
          ruleId: 'boost_work_mode_on_interest',
          fromEventIds: [event.id],
          message: `Interested/saved listing with work mode "${event.jobWorkMode}".`,
          rejectionReasons: [],
        });
      }
      for (const d of event.jobDepartments ?? []) {
        if (d.trim()) preferredIndustries.add(d.trim());
      }
    }

    if (event.type === 'rejected') {
      if (reasons.includes('unwanted_industry')) {
        for (const d of event.jobDepartments ?? []) {
          if (d.trim()) excludedIndustries.add(d.trim());
        }
        inferences.push({
          ruleId: 'exclude_industry_on_reject',
          fromEventIds: [event.id],
          message:
            'Rejection reason unwanted_industry → add job departments to excluded industries.',
          rejectionReasons: ['unwanted_industry'],
        });
      }
      if (
        reasons.includes('wrong_work_mode') &&
        event.jobWorkMode &&
        event.jobWorkMode !== 'unknown'
      ) {
        demotedWorkModes.add(event.jobWorkMode);
        preferredWorkModes.delete(event.jobWorkMode);
        inferences.push({
          ruleId: 'demote_work_mode_on_reject',
          fromEventIds: [event.id],
          message: `Rejection reason wrong_work_mode → demote "${event.jobWorkMode}".`,
          rejectionReasons: ['wrong_work_mode'],
        });
      }
      if (reasons.includes('wrong_role') && event.jobTitle?.trim()) {
        inferences.push({
          ruleId: 'note_wrong_role',
          fromEventIds: [event.id],
          message: `Rejected role title "${event.jobTitle.trim()}" (not added to preferred titles).`,
          rejectionReasons: ['wrong_role'],
        });
      }
    }
  }

  return LearnedPreferencesPayloadSchema.parse({
    learningVersion: PREFERENCE_LEARNING_VERSION,
    preferredJobTitles: [...preferredJobTitles].slice(0, 40),
    preferredIndustries: [...preferredIndustries].slice(0, 40),
    excludedIndustries: [...excludedIndustries].slice(0, 40),
    preferredWorkModes: [...preferredWorkModes],
    demotedWorkModes: [...demotedWorkModes],
    inferences: inferences.slice(0, 200),
    sourceEventCount: events.length,
    computedAt: now.toISOString(),
  });
}

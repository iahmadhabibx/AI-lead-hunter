import type {
  CandidateProfilePayload,
  CanonicalJob,
  ComponentScore,
  MatchEvidence,
} from '@aijh/contracts';
import { DEFAULT_MATCH_WEIGHTS } from '@aijh/contracts';
import { detectSponsorshipSignal, jaccard, tokenize } from './text';

export function scoreComponents(
  profile: CandidateProfilePayload,
  job: CanonicalJob,
): { components: ComponentScore[]; evidence: MatchEvidence[] } {
  const evidence: MatchEvidence[] = [];
  const weights = DEFAULT_MATCH_WEIGHTS;
  const jobText = [job.title, job.descriptionText, ...job.departments]
    .filter(Boolean)
    .join(' ');

  // Skills
  const skillNames = profile.skills.map((s) => s.name).filter(Boolean);
  let skillsScore: number | null = null;
  let skillsStatus: ComponentScore['status'] = 'unknown';
  if (skillNames.length === 0 || !jobText.trim()) {
    skillsStatus = 'unknown';
    evidence.push({
      component: 'skills',
      kind: 'unknown',
      message: 'Insufficient skill or job-text evidence to score skills.',
    });
  } else {
    const matched = skillNames.filter((s) =>
      jobText.toLowerCase().includes(s.toLowerCase()),
    );
    skillsScore = matched.length / skillNames.length;
    skillsStatus = 'scored';
    if (matched.length) {
      evidence.push({
        component: 'skills',
        kind: 'support',
        message: `Matched skills: ${matched.slice(0, 8).join(', ')}`,
      });
    }
    const missing = skillNames.filter((s) => !matched.includes(s));
    if (missing.length) {
      evidence.push({
        component: 'skills',
        kind: 'missing',
        message: `Profile skills not evidenced in job text: ${missing.slice(0, 8).join(', ')}`,
      });
    }
  }

  // Experience / seniority (heuristic from months vs title keywords)
  let experienceScore: number | null = null;
  let experienceStatus: ComponentScore['status'] = 'unknown';
  const months = profile.totalExperienceMonths;
  const seniorHints = /senior|staff|principal|lead|director/i.test(job.title);
  const juniorHints = /junior|intern|entry|graduate/i.test(job.title);
  if (months == null) {
    experienceStatus = 'unknown';
    evidence.push({
      component: 'experience',
      kind: 'unknown',
      message: 'Candidate total experience months unknown.',
      profilePath: 'totalExperienceMonths',
    });
  } else {
    experienceStatus = 'scored';
    if (seniorHints && months < 60) experienceScore = 0.35;
    else if (juniorHints && months > 96) experienceScore = 0.45;
    else if (seniorHints && months >= 60) experienceScore = 0.9;
    else experienceScore = Math.min(1, months / 96);
    evidence.push({
      component: 'experience',
      kind: 'support',
      message: `Using ${months} months of validated experience against title cues.`,
      profilePath: 'totalExperienceMonths',
    });
  }

  // Role alignment
  const titles = profile.preferences.preferredJobTitles ?? [];
  const empTitles = profile.employment
    .map((e) => e.title)
    .filter((t): t is string => Boolean(t));
  const roleCorpus = [...titles, ...empTitles];
  let roleScore: number | null = null;
  let roleStatus: ComponentScore['status'] = 'unknown';
  if (roleCorpus.length === 0) {
    roleStatus = 'unknown';
    evidence.push({
      component: 'role',
      kind: 'unknown',
      message: 'No preferred or historical titles to align with job title.',
    });
  } else {
    roleScore = jaccard(tokenize(job.title), roleCorpus.flatMap(tokenize));
    roleStatus = 'scored';
    evidence.push({
      component: 'role',
      kind: roleScore > 0.15 ? 'support' : 'missing',
      message: `Title token overlap score ${roleScore.toFixed(2)}.`,
    });
  }

  // Work mode / location soft score
  let locScore: number | null = null;
  let locStatus: ComponentScore['status'] = 'unknown';
  const modes = (profile.preferences.preferredWorkModes ?? []).filter(
    (m) => m !== 'unknown',
  );
  if (modes.length === 0 && !profile.location.preferredCountries.length) {
    locStatus = 'unknown';
    evidence.push({
      component: 'workModeLocation',
      kind: 'unknown',
      message: 'No work-mode or country preferences configured.',
    });
  } else if (job.workMode === 'unknown' && !job.locationText) {
    locStatus = 'unknown';
    evidence.push({
      component: 'workModeLocation',
      kind: 'unknown',
      message: 'Job work mode and location are unknown.',
    });
  } else {
    locStatus = 'scored';
    let score = 0.5;
    if (modes.length && job.workMode !== 'unknown') {
      score = modes.includes(job.workMode) ? 1 : 0.1;
    }
    const countries = profile.location.preferredCountries;
    if (countries.length && job.locationText) {
      const hit = countries.some((c) =>
        job.locationText!.toLowerCase().includes(c.toLowerCase()),
      );
      score = (score + (hit || job.workMode === 'remote' ? 1 : 0.2)) / 2;
    }
    locScore = score;
    evidence.push({
      component: 'workModeLocation',
      kind: 'support',
      message: `Work-mode/location soft score ${score.toFixed(2)}.`,
    });
  }

  // Compensation — only when both sides have comparable data
  let compScore: number | null = null;
  let compStatus: ComponentScore['status'] = 'unknown';
  const salary = prefsSalary(profile);
  const jobSalary = extractSalaryHint(job.descriptionText);
  if (!salary || jobSalary == null) {
    compStatus = 'unknown';
    evidence.push({
      component: 'compensation',
      kind: 'unknown',
      message:
        'Comparable compensation data missing on profile and/or job — not scored as positive.',
    });
  } else {
    compStatus = 'scored';
    if (salary.min != null && jobSalary < salary.min) compScore = 0.2;
    else if (salary.max != null && jobSalary > salary.max * 1.5) compScore = 0.6;
    else compScore = 0.85;
    evidence.push({
      component: 'compensation',
      kind: 'support',
      message: `Compared job salary hint ${jobSalary} to preference bounds.`,
    });
  }

  // Industry / interests
  let industryScore: number | null = null;
  let industryStatus: ComponentScore['status'] = 'unknown';
  const preferred = profile.preferences.preferredIndustries ?? [];
  if (preferred.length === 0) {
    industryStatus = 'unknown';
    evidence.push({
      component: 'industry',
      kind: 'unknown',
      message: 'No preferred industries configured.',
    });
  } else {
    industryStatus = 'scored';
    const hit = preferred.filter(
      (p) =>
        jobText.toLowerCase().includes(p.toLowerCase()) ||
        job.departments.some((d) => d.toLowerCase().includes(p.toLowerCase())),
    );
    industryScore = hit.length / preferred.length;
    evidence.push({
      component: 'industry',
      kind: hit.length ? 'support' : 'missing',
      message: hit.length
        ? `Matched industries: ${hit.join(', ')}`
        : 'Preferred industries not evidenced in job.',
    });
  }

  // Sponsorship unknown tracking
  if (
    (profile.preferences.workAuthorization?.requiresSponsorship ??
      'unknown') === 'yes' &&
    detectSponsorshipSignal(job.descriptionText) === 'unknown'
  ) {
    evidence.push({
      kind: 'unknown',
      message:
        'Sponsorship required by candidate but not evidenced in job text.',
    });
  }

  const components: ComponentScore[] = [
    {
      id: 'skills',
      weight: weights.skills,
      score: skillsScore,
      status: skillsStatus,
      explanation:
        skillsStatus === 'unknown'
          ? 'Skills component unknown.'
          : `Skills overlap ${(skillsScore ?? 0).toFixed(2)}.`,
    },
    {
      id: 'experience',
      weight: weights.experience,
      score: experienceScore,
      status: experienceStatus,
      explanation:
        experienceStatus === 'unknown'
          ? 'Experience unknown.'
          : `Experience score ${(experienceScore ?? 0).toFixed(2)}.`,
    },
    {
      id: 'role',
      weight: weights.role,
      score: roleScore,
      status: roleStatus,
      explanation:
        roleStatus === 'unknown'
          ? 'Role alignment unknown.'
          : `Role score ${(roleScore ?? 0).toFixed(2)}.`,
    },
    {
      id: 'workModeLocation',
      weight: weights.workModeLocation,
      score: locScore,
      status: locStatus,
      explanation:
        locStatus === 'unknown'
          ? 'Work mode/location unknown.'
          : `Location/mode score ${(locScore ?? 0).toFixed(2)}.`,
    },
    {
      id: 'compensation',
      weight: weights.compensation,
      score: compScore,
      status: compStatus,
      explanation:
        compStatus === 'unknown'
          ? 'Compensation unknown.'
          : `Compensation score ${(compScore ?? 0).toFixed(2)}.`,
    },
    {
      id: 'industry',
      weight: weights.industry,
      score: industryScore,
      status: industryStatus,
      explanation:
        industryStatus === 'unknown'
          ? 'Industry unknown.'
          : `Industry score ${(industryScore ?? 0).toFixed(2)}.`,
    },
  ];

  return { components, evidence };
}

function prefsSalary(profile: CandidateProfilePayload) {
  const s = profile.preferences.salary;
  if (!s) return null;
  if (s.min == null && s.max == null) return null;
  return s;
}

/** Very conservative salary number extraction — returns null if unclear. */
function extractSalaryHint(text: string | null): number | null {
  if (!text) return null;
  const m = text.match(/\$\s?(\d{2,3})(?:[, ]?(\d{3}))?\s*(?:k|K)?/);
  if (!m) return null;
  const whole = m[1];
  const rest = m[2];
  if (!whole) return null;
  if (rest) return Number(whole) * 1000 + Number(rest);
  const n = Number(whole);
  // treat 2–3 digit with k as thousands
  if (/k/i.test(m[0]) || n < 1000) return n * 1000;
  return n;
}

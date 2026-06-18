/**
 * Social Media Auto-Post Service
 * Posts job listings to Facebook, LinkedIn, and Twitter/X when a job is published.
 * Tokens are configured via environment variables — posts are silently skipped
 * if the corresponding token is missing.
 */

interface JobData {
  id: string;
  title: string;
  roleCategory: string;
  employmentType: string;
  workMode: string;
  city?: string;
  description?: string;
  qualifications?: string;
  salary?: string;
  compensationModel?: string;
}

interface PostResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

function buildJobPost(job: JobData, applyUrl: string): { text: string; richText: string } {
  const lines = [
    `We're hiring: ${job.title}`,
    '',
    `${job.employmentType} | ${job.workMode}${job.city ? ` | ${job.city}` : ''}`,
  ];
  if (job.description) {
    const short = job.description.length > 200 ? job.description.slice(0, 197) + '...' : job.description;
    lines.push('', short);
  }
  if (job.salary || job.compensationModel) {
    lines.push('', `Compensation: ${job.salary || job.compensationModel}`);
  }
  lines.push('', `Apply now: ${applyUrl}`, '', '#hiring #jobs #MetryxOne');

  return { text: lines.join('\n'), richText: lines.join('\n') };
}

// ── Facebook Page Post ──────────────────────────────────────────────
async function postToFacebook(job: JobData, applyUrl: string): Promise<PostResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) {
    return { platform: 'facebook', success: false, error: 'Missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN' };
  }

  const { text } = buildJobPost(job, applyUrl);
  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, access_token: token }),
  });
  const data = await res.json() as any;

  if (!res.ok) {
    return { platform: 'facebook', success: false, error: data.error?.message || `HTTP ${res.status}` };
  }
  return { platform: 'facebook', success: true, postId: data.id };
}

// ── LinkedIn Organization Post ──────────────────────────────────────
async function postToLinkedIn(job: JobData, applyUrl: string): Promise<PostResult> {
  const orgId = process.env.LINKEDIN_ORG_ID;
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!orgId || !token) {
    return { platform: 'linkedin', success: false, error: 'Missing LINKEDIN_ORG_ID or LINKEDIN_ACCESS_TOKEN' };
  }

  const { text } = buildJobPost(job, applyUrl);
  const url = 'https://api.linkedin.com/v2/ugcPosts';

  const body = {
    author: `urn:li:organization:${orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;

  if (!res.ok) {
    return { platform: 'linkedin', success: false, error: data.message || `HTTP ${res.status}` };
  }
  return { platform: 'linkedin', success: true, postId: data.id };
}

// ── Twitter / X Post ────────────────────────────────────────────────
async function postToTwitter(job: JobData, applyUrl: string): Promise<PostResult> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return { platform: 'twitter', success: false, error: 'Missing Twitter API credentials' };
  }

  // Twitter OAuth 1.0a signature
  const nonce = Math.random().toString(36).substring(2);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const tweetText = `We're hiring: ${job.title}\n${job.employmentType} | ${job.workMode}${job.city ? ` | ${job.city}` : ''}\n\nApply: ${applyUrl}\n\n#hiring #jobs`;
  // Trim to 280 chars
  const text = tweetText.length > 280 ? tweetText.slice(0, 277) + '...' : tweetText;

  const params: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  // Build signature base string
  const url = 'https://api.twitter.com/2/tweets';
  const paramString = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  const baseString = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;

  // HMAC-SHA1 using Web Crypto (Node 18+) or fallback
  const { createHmac } = await import('crypto');
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');
  params['oauth_signature'] = signature;

  const authHeader = 'OAuth ' + Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(', ');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const data = await res.json() as any;

  if (!res.ok) {
    return { platform: 'twitter', success: false, error: data.detail || data.title || `HTTP ${res.status}` };
  }
  return { platform: 'twitter', success: true, postId: data.data?.id };
}

// ── Main orchestrator ───────────────────────────────────────────────
export async function autoPostJob(job: JobData, flags: {
  postToFacebook: boolean;
  postToLinkedIn: boolean;
  postToTwitter: boolean;
}): Promise<PostResult[]> {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://metryxone.com';
  const applyUrl = `${clientOrigin}/careers?job=${job.id}`;
  const results: PostResult[] = [];

  const tasks: Promise<PostResult>[] = [];
  if (flags.postToFacebook)  tasks.push(postToFacebook(job, applyUrl));
  if (flags.postToLinkedIn)  tasks.push(postToLinkedIn(job, applyUrl));
  if (flags.postToTwitter)   tasks.push(postToTwitter(job, applyUrl));

  if (tasks.length === 0) return results;

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(s.value);
    } else {
      results.push({ platform: 'unknown', success: false, error: s.reason?.message || 'Unknown error' });
    }
  }

  return results;
}

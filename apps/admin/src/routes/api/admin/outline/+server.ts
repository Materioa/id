import { json, type RequestHandler } from '@sveltejs/kit';
import { styleGuidelines } from '$lib/server/insightroom-guidelines';
import { validateToken, getCookieToken } from '$lib/server/insightroom-auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

function buildStructuredOutline(topic: string): string {
  const cleanTopic = topic.trim() || 'Technical Deep Dive';
  return `# ${cleanTopic}

## 1. Concrete Scenario
*2–3 sentences describing a real-world engineering challenge or concrete scenario in direct "you"-addressed language. Do NOT start with a definition or "In this post".*

## 2. Core Architecture & Formal Definition
*Precise academic definition followed by core system mechanics and component interactions.*

- **Component A**: Primary role and data contract.
- **Component B**: State management and lifecycle coordination.

## 3. Step-by-Step Lifecycle
1. **Trigger**: Event dispatch or entrypoint initialization.
2. **Execution**: Processing pipeline and invariant validation.
3. **Settlement**: State persistence and response delivery.

## 4. Working Implementation
\`\`\`ts
// Runnable implementation demonstrating ${cleanTopic}
export function executeCoreWorkflow(input: unknown) {
  // 1. Validation
  // 2. Transformation
  // 3. Execution
}
\`\`\`

## 5. Production Edge Cases & Silent Failures
- **Race conditions**: How concurrency impacts this workflow.
- **Boundary limits**: Exact numbers and memory constraints.
- **Degradation mode**: Fallback behavior when downstream dependencies fail.

## 6. Key Takeaways Table
| Concept | Mechanism | Production Impact |
|---|---|---|
| Latency | Microsecond bounds | Minimizes queue stall |
| Durability | WAL persistence | Zero data loss on crash |
| Isolation | Snapshot isolation | Prevents dirty reads |

## 7. Knowledge Check
[mcq: What is the primary operational trade-off when implementing ${cleanTopic}? | Option A | *Correct option with precise technical rationale* | Option C | Option D]
`;
}

export const POST: RequestHandler = async ({ request, cookies, fetch }) => {
  let token = getCookieToken(cookies);
  const authHeader = request.headers.get('Authorization');
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token) return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const { user, accessTier } = await validateToken(token, fetch);
  if (!user || accessTier !== 'super') {
    return json({ error: 'Unauthorized: Admin privileges required' }, { status: 403, headers: corsHeaders });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const topic = body?.topic || '';
    const outline = buildStructuredOutline(topic);

    return json({
      success: true,
      topic,
      outline,
      guidelines: styleGuidelines
    }, { headers: corsHeaders });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
};

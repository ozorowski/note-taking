import { getClient } from './db'

/**
 * Creates a fully-seeded demo project for the given user and returns it.
 * Called automatically on every login so the demo is always fresh.
 */
export async function createDemoProject(userId: string): Promise<{ id: string }> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const projResult = await client.query(
      `INSERT INTO projects (title, description, owner_id, demo, current_phase)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        'Research Synthesis — Demo',
        'A fully worked example showing the complete Trace workflow: interviews → notes → themes → insights → recommendations.',
        userId,
        true,
        'recommendations',
      ]
    )
    const project = projResult.rows[0]

    await client.query(
      `INSERT INTO project_memberships (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [project.id, userId]
    )

    await seedDemoData(client, project.id, userId)

    await client.query('COMMIT')
    return project
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

async function seedDemoData(client: any, projectId: string, userId: string) {
  // ── 5 interviews ──────────────────────────────────────────────────────────
  const interviews = [
    {
      name: 'Alex Chen',
      notes: 'Senior UX researcher, 6 years exp. Works in a team of 4. Uses Miro + Notion + Google Docs in every project. "I always end up re-doing analysis I\'ve already done because I can\'t find the original." Spends ~3 days on synthesis per project.',
    },
    {
      name: 'Priya Sharma',
      notes: 'Research lead managing 3 junior researchers. Frustrated by lack of evidence trails. "When a stakeholder challenges a recommendation I can\'t show them exactly where it came from — it erodes trust." Wants a consistent team process.',
    },
    {
      name: 'Tom Nguyen',
      notes: 'Junior researcher, 1 year in role. Overwhelmed by synthesis phase. "I copy-paste between Miro, Notion, and Docs constantly. It feels like admin, not research." Uncertain whether his insights are good quality.',
    },
    {
      name: 'Sara Kim',
      notes: 'Product designer who runs lightweight research. Does 5–10 interviews per quarter. "I don\'t have a researcher\'s training so synthesis feels like guesswork. I just write what felt important." Worried recommendations seem subjective.',
    },
    {
      name: 'Marcus Rodriguez',
      notes: 'Research ops manager. Trying to standardise process across 8 researchers. "Every researcher has their own way of doing synthesis. We can\'t compare studies or build institutional knowledge." Wants templates and guardrails.',
    },
  ]

  const interviewIds: string[] = []
  for (const iv of interviews) {
    const r = await client.query(
      `INSERT INTO interviews (project_id, participant_name, raw_notes, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, iv.name, iv.notes, userId]
    )
    interviewIds.push(r.rows[0].id)
  }

  // ── 42 notes spread across all 5 interviews ───────────────────────────────
  const notesData = [
    // Alex Chen (i=0)
    { content: '"I never know where the latest version of the synthesis doc is — there are always 3 copies."', i: 0 },
    { content: '"We use Miro for clustering but the sticky notes just float around with no structure after the session."', i: 0 },
    { content: '"When I join a project mid-way, there\'s no way to get up to speed quickly."', i: 0 },
    { content: 'Observed: had 5 browser tabs open — Miro, Notion, two Google Docs, and Slack — all for the same project.', i: 0 },
    { content: '"I duplicate my Notion template at the start of every project. Setup alone takes 30 minutes."', i: 0 },
    { content: '"Sometimes I forget which quote came from which participant because we strip names out early."', i: 0 },
    { content: '"The hardest part is the leap from themes to insights — it feels arbitrary when I do it."', i: 0 },
    { content: 'Observed: spent 20 minutes searching Slack for a note a colleague had shared two weeks earlier.', i: 0 },
    { content: '"We rarely get to write recommendations because synthesis takes so long the project moves on."', i: 0 },
    // Priya Sharma (i=1)
    { content: '"We have no audit trail at all. Stakeholders ask where insights come from and I can\'t show them."', i: 1 },
    { content: '"I can\'t give junior researchers a clear process to follow. Everyone does synthesis differently."', i: 1 },
    { content: '"Our recommendations get challenged in presentations because they look like opinions, not evidence."', i: 1 },
    { content: '"I copy quotes into one doc, themes into another, then insights into a slide deck. It\'s four separate artefacts."', i: 1 },
    { content: 'Observed: team used a shared spreadsheet to track themes — it had 3 versions with conflicting content.', i: 1 },
    { content: '"When I hand off to another researcher mid-project, context is always lost. They start over."', i: 1 },
    { content: '"If AI could name or describe themes based on the notes inside them, that alone would save hours."', i: 1 },
    { content: '"I want to show a stakeholder the exact participant quote that backs up a recommendation."', i: 1 },
    { content: '"The gap between raw notes and actionable insights is where quality falls apart."', i: 1 },
    { content: '"We don\'t have shared definitions for what a theme is versus an insight versus a recommendation."', i: 1 },
    { content: '"I\'ve started skipping the themes phase to save time, but the insights are noticeably weaker."', i: 1 },
    // Tom Nguyen (i=2)
    { content: '"Synthesis takes me 2–3 days and I\'m still not confident the output is right."', i: 2 },
    { content: '"I got feedback that my insights were too vague. I didn\'t know how to make them more concrete."', i: 2 },
    { content: 'Observed: drag-and-drop in current tool (Miro) was laggy on large boards; gave up and used text lists instead.', i: 2 },
    { content: '"I spend more time formatting docs than actually thinking about the research."', i: 2 },
    { content: '"I\'d love a tool that imposes a consistent process so I know I\'m not missing anything."', i: 2 },
    { content: '"When we ran a follow-up study, we couldn\'t easily compare it to the first round."', i: 2 },
    { content: '"The biggest problem is going from a pile of sticky notes to something I can present to stakeholders."', i: 2 },
    { content: '"I\'m always worried I\'m overlooking something important buried in the data."', i: 2 },
    // Sara Kim (i=3)
    { content: '"I don\'t know the right way to group notes. I end up with either one huge theme or twenty tiny ones."', i: 3 },
    { content: '"I present findings as bullet points because I don\'t know how to write a proper insight."', i: 3 },
    { content: '"When my recommendations get pushed back I can\'t defend them because I can\'t retrace my logic."', i: 3 },
    { content: '"I wish there was a checklist or progress indicator telling me if my synthesis is complete enough."', i: 3 },
    { content: 'Observed: synthesis notes stored in 3 different tools with no cross-references between them.', i: 3 },
    { content: '"I\'d use AI drafts as a starting point, but I\'d want to review and rewrite them myself."', i: 3 },
    { content: '"It would help to see an example of a well-structured insight so I know what I\'m aiming for."', i: 3 },
    // Marcus Rodriguez (i=4)
    { content: '"Eight researchers, eight different processes. We can\'t build on each other\'s work."', i: 4 },
    { content: '"I\'ve tried to create a shared template in Notion but nobody uses it consistently."', i: 4 },
    { content: '"We can\'t benchmark synthesis quality or track whether it improves over time."', i: 4 },
    { content: '"Onboarding a new researcher takes months partly because there\'s no documented synthesis workflow."', i: 4 },
    { content: '"The tools researchers use are chosen individually — we have no standardised stack."', i: 4 },
    { content: '"If a researcher leaves, all their synthesis context walks out the door with them."', i: 4 },
    { content: '"I want AI to flag when an insight isn\'t backed by enough evidence, not just draft it."', i: 4 },
  ]

  const noteIds: string[] = []
  for (const n of notesData) {
    const r = await client.query(
      `INSERT INTO notes (project_id, interview_id, content, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, interviewIds[n.i], n.content, userId]
    )
    noteIds.push(r.rows[0].id)
  }

  // ── 7 themes ──────────────────────────────────────────────────────────────
  const themesData = [
    { title: 'Tool fragmentation',      desc: 'Researchers use many disconnected tools; switching cost is high and data is scattered.' },
    { title: 'Evidence traceability',   desc: 'No clear, navigable link from recommendations back to source quotes.' },
    { title: 'Process inconsistency',   desc: 'No shared synthesis methodology — every researcher reinvents the wheel.' },
    { title: 'Collaboration & handoff', desc: 'Hard to work on synthesis together or transfer context without losing fidelity.' },
    { title: 'Synthesis bottleneck',    desc: 'The step from raw notes to actionable insights is the slowest, highest-effort phase.' },
    { title: 'AI as a co-pilot',        desc: 'Strong appetite for AI drafts and suggestions, with researcher retaining final judgment.' },
    { title: 'Stakeholder credibility', desc: 'Recommendations lack perceived rigour because evidence chains are invisible.' },
  ]

  const themeIds: string[] = []
  for (const t of themesData) {
    const r = await client.query(
      `INSERT INTO themes (project_id, title, description, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, t.title, t.desc, userId]
    )
    themeIds.push(r.rows[0].id)
  }

  // ── Cluster all 42 notes into themes ─────────────────────────────────────
  // [noteIndex, themeIndex]  (0=Tool frag, 1=Traceability, 2=Process, 3=Collab, 4=Bottleneck, 5=AI, 6=Credibility)
  const noteMappings: [number, number][] = [
    [0,0],[1,0],[2,3],[3,0],[4,0],[5,1],[6,4],[7,0],[8,4],
    [9,1],[10,2],[11,6],[12,0],[13,2],[14,3],[15,5],[16,1],[17,4],[18,2],[19,4],
    [20,4],[21,4],[22,0],[23,4],[24,2],[25,2],[26,4],[27,4],
    [28,2],[29,4],[30,6],[31,2],[32,0],[33,5],[34,2],
    [35,2],[36,2],[37,2],[38,3],[39,0],[40,3],[41,5],
  ]

  for (const [nIdx, tIdx] of noteMappings) {
    await client.query(
      `INSERT INTO note_themes (note_id, theme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [noteIds[nIdx], themeIds[tIdx]]
    )
  }

  // ── 6 pre-seeded insights in structured format ────────────────────────────
  const insightsData = [
    {
      content: 'When conducting synthesis across a project, researchers switch between 3–5 disconnected tools (Miro, Notion, Docs, Slack), because no single tool covers the full workflow from raw notes to recommendations, which leads to an estimated 40–60% of synthesis time being spent on logistics rather than analysis.',
      evidence: 'Alex had 5 browser tabs open for the same project. Tom described formatting and setup consuming more time than thinking. Every participant named at least 3 separate tools used in a single project.',
      themes: [0, 4],
    },
    {
      content: 'When presenting recommendations to stakeholders, researchers cannot trace findings back to specific participant quotes, because synthesis artefacts are stored across multiple disconnected documents without cross-references, which leads to recommendations being challenged as subjective opinion and trust in the research eroding.',
      evidence: 'Priya reported recommendations being challenged in presentations. Sara said she couldn\'t defend her findings when pushed back. Both described having no audit trail to point to.',
      themes: [1, 6],
    },
    {
      content: 'When a new researcher joins a team or project, they cannot follow a consistent synthesis methodology, because each researcher has developed a personal workflow in the absence of shared standards, which leads to inconsistent insight quality and the inability to compare findings across studies or researchers.',
      evidence: 'Marcus manages 8 researchers, all using different approaches. Priya has been unable to provide a replicable process for junior researchers. Tom received vague feedback on his insights with no framework to improve from.',
      themes: [2, 3],
    },
    {
      content: 'When moving from clustered themes to written insights, researchers experience peak uncertainty and friction, because there is no structured framework or quality bar to guide the transition, which leads to insights that are vague, skipped under time pressure, or not credible enough to drive decisions.',
      evidence: 'Alex described the themes-to-insights step as "arbitrary." Tom received feedback his insights were too vague and didn\'t know how to fix them. Sara admitted she presents bullet points rather than insights because she\'s unsure what a good insight looks like.',
      themes: [4, 2],
    },
    {
      content: 'When researchers hit blank-page moments during synthesis, they are open to AI-generated drafts as a starting point, because the cognitive effort of initial framing is high and time-consuming, which leads to a strong preference for an AI co-pilot model where they review and rewrite output rather than accept it wholesale.',
      evidence: 'Sara explicitly said she would use AI drafts but wants to rewrite them. Marcus wants AI to flag weak evidence rather than just generate text. Priya identified theme-naming as the highest-value AI use case.',
      themes: [5],
    },
    {
      content: 'When a researcher transitions off a project or leaves the organisation, all synthesis context and reasoning is permanently lost, because the logic behind insights and recommendations is stored in the researcher\'s memory rather than in a structured and navigable artefact, which leads to colleagues restarting synthesis from scratch and the same institutional knowledge being repeatedly rediscovered.',
      evidence: 'Priya described handoffs routinely causing colleagues to start over. Marcus noted that researcher departures mean context "walks out the door." Alex couldn\'t onboard a new team member without a full verbal re-briefing.',
      themes: [3, 1],
    },
  ]

  const insightIds: string[] = []
  for (const ins of insightsData) {
    const r = await client.query(
      `INSERT INTO insights (project_id, content, evidence_summary, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, ins.content, ins.evidence, userId]
    )
    const insightId = r.rows[0].id
    insightIds.push(insightId)
    for (const tIdx of ins.themes) {
      await client.query(
        `INSERT INTO insight_themes (insight_id, theme_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [insightId, themeIds[tIdx]]
      )
    }
  }

  // ── 4 pre-seeded recommendations ─────────────────────────────────────────
  const recsData = [
    {
      content: 'Design a unified synthesis workspace that keeps interviews, notes, themes, insights, and recommendations in one navigable place — eliminating the need for external docs or slide decks.',
      rationale: 'Tool fragmentation is the single biggest time sink. Consolidating the workflow removes switching cost and creates the artefact trail that is currently missing.',
      insights: [0, 1],
    },
    {
      content: 'Introduce mandatory phase gates with clear completion criteria (e.g. ≥70% of notes clustered, each insight linked to ≥1 theme) so researchers can\'t skip steps and know when their synthesis is rigorous enough.',
      rationale: 'Process inconsistency and the confidence gap at the themes→insights step are rooted in the absence of shared standards. Explicit gates encode best practice without requiring managerial policing.',
      insights: [2, 3],
    },
    {
      content: 'Offer AI-generated drafts at the insight and recommendation steps that pre-fill a review form, making it fast to accept, edit, or reject — rather than generating text that replaces the researcher\'s voice.',
      rationale: 'Participants are enthusiastic about AI assistance but protective of ownership. A review-first model matches their mental model and removes the blank-page friction without diminishing analytical rigour.',
      insights: [4],
    },
    {
      content: 'Build a traceable evidence chain UI that lets any stakeholder click from a recommendation through to the exact participant quotes that support it, and export this chain for presentations.',
      rationale: 'Stakeholder credibility and knowledge preservation are both solved by the same mechanism: a persistent, inspectable link from recommendation back to evidence. This also makes handoffs recoverable.',
      insights: [1, 5],
    },
  ]

  for (const rec of recsData) {
    const r = await client.query(
      `INSERT INTO recommendations (project_id, content, rationale, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, rec.content, rec.rationale, userId]
    )
    const recId = r.rows[0].id
    for (const iIdx of rec.insights) {
      await client.query(
        `INSERT INTO recommendation_insights (recommendation_id, insight_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [recId, insightIds[iIdx]]
      )
    }
  }
}

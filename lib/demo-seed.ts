import { getClient } from './db'

/**
 * Creates a demo project for the given user and returns it.
 * Called automatically on every login so the demo is always fresh.
 *
 * State: 5 interviews, 42 notes, 7 themes (all clustered) — ready at the
 * Insights phase with no insights yet, so you can demo AI generation live.
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
        '5 interviews, 42 notes ready to cluster. Use "Cluster with AI" to group notes into themes, then generate insights.',
        userId,
        true,
        'themes',
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

  for (const n of notesData) {
    await client.query(
      `INSERT INTO notes (project_id, interview_id, content, created_by) VALUES ($1,$2,$3,$4)`,
      [projectId, interviewIds[n.i], n.content, userId]
    )
  }
  // Themes, insights, and recommendations are intentionally left empty —
  // the demo starts at the Themes phase so you can show AI clustering,
  // then AI insight generation, live.
}

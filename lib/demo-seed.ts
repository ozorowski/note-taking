import { getClient } from './db'

/**
 * Creates a demo project for the given user and returns it.
 * Called automatically on every login so the demo is always fresh.
 *
 * Scenario: Deliveroo usability study — 5 participants, 40 notes.
 * Starts at the Themes phase with no themes seeded, ready to demo
 * AI clustering, then AI insight and recommendation generation live.
 */
export async function createDemoProject(userId: string): Promise<{ id: string }> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    const projResult = await client.query(
      `INSERT INTO projects (title, description, owner_id, demo, current_phase)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        'Deliveroo App — Usability Study',
        'Evaluate the end-to-end ordering experience on the Deliveroo app, from restaurant discovery to order completion, with a focus on task success and user confidence.',
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
  // ── 5 participants ─────────────────────────────────────────────────────────
  const interviews = [
    {
      name: 'Emma Thompson',
      notes: 'Age 27, marketing manager, orders Deliveroo 3–4x per week. Primarily uses iPhone. Very comfortable with technology. Main use case: solo weeknight dinners and occasional team lunches. Has been using Deliveroo for 3 years.',
    },
    {
      name: 'James Wilson',
      notes: 'Age 38, parent of two, orders for family meals 1–2x per week. Uses Android. Moderate tech confidence. Often ordering for multiple people with different dietary requirements. Compares Deliveroo against Uber Eats regularly.',
    },
    {
      name: 'Sofia Martinez',
      notes: 'Age 24, food blogger and enthusiast. Orders 5+ times per week across multiple platforms. Power user — explores new cuisines, writes reviews. Uses Deliveroo Plus subscription. Very opinionated about the discovery experience.',
    },
    {
      name: 'David Okafor',
      notes: 'Age 45, consultant. Orders for work lunches 2–3x per week, sometimes for client meetings. Values speed and reliability above all. Has had multiple bad experiences with incorrect orders. Uses saved addresses and payment methods heavily.',
    },
    {
      name: 'Lily Chen',
      notes: 'Age 21, university student. New Deliveroo user — only been using for 2 months. Budget-conscious, uses promo codes frequently. Often orders with flatmates and splits bills. Finds the app occasionally confusing.',
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

  // ── 40 notes spread across 5 participants ──────────────────────────────────
  const notesData = [
    // Emma Thompson (i=0) — 8 notes
    { content: '"I just type what I fancy into search — but the results feel random. Sometimes a pizza place comes up when I search for sushi."', i: 0 },
    { content: '"The filters are buried. I always forget where they are and end up scrolling past places I can\'t eat at."', i: 0 },
    { content: 'Observed: Emma tapped the search bar, typed "Thai", scrolled past 6 sponsored results before finding an organic one. Said "these sponsored ones are annoying."', i: 0 },
    { content: '"I wish I could save filter presets — I always want the same things: under 30 min, no minimum order, 4 stars or above."', i: 0 },
    { content: '"Reordering is the feature I use most. But sometimes it fails silently — I don\'t realise an item is unavailable until checkout."', i: 0 },
    { content: 'Observed: Emma tried to customise a burger — she missed the "required" modifier step and the app blocked her at checkout without a clear error message. Took 90 seconds to find and fix it.', i: 0 },
    { content: '"The ETA shown on the restaurant page is never what I actually get. I\'ve stopped trusting it — I just assume add 15 minutes."', i: 0 },
    { content: '"I love the live tracking map but it disappears sometimes. Once it just said \'your order is on its way\' for 40 minutes with no map."', i: 0 },

    // James Wilson (i=1) — 8 notes
    { content: '"Ordering for a family is a nightmare. There\'s no way to organise the basket by person. I have to scroll up and down constantly to check what I\'ve added."', i: 1 },
    { content: '"The dietary filter options are too basic — there\'s no \'nut-free\' option and my daughter has a nut allergy. I have to read every item description manually."', i: 1 },
    { content: 'Observed: James spent 4 minutes searching for allergen information on a dish. Eventually found a small "contains" list in grey text at the bottom of the item description. "This should be front and centre."', i: 1 },
    { content: '"When I add a note to the order like \'no onions\', I have no idea if the restaurant actually sees it. I\'ve had onions every time."', i: 1 },
    { content: '"The \'popular items\' section is useful but I always wonder — popular with who? Is it popular in my area? This week? Ever?"', i: 1 },
    { content: '"I\'ve had three orders where an item went missing and the refund process took over a week. Now I take a photo of the bag when it arrives."', i: 1 },
    { content: '"Comparing restaurants is hard — I have to open each one, check the menu and prices, go back, open another. There\'s no side-by-side view."', i: 1 },
    { content: 'Observed: James tried to apply a promo code at checkout — the field was hidden inside an "offers" accordion that he didn\'t notice for 2 minutes. "I nearly missed it."', i: 1 },

    // Sofia Martinez (i=2) — 8 notes
    { content: '"Discovery is the weakest part of the app. I know what cuisines I want to explore but there\'s no way to browse by ingredient or cooking style — only by cuisine category."', i: 2 },
    { content: '"The \'new restaurants\' section is great when it appears — but it only shows up sometimes. I don\'t know when it\'ll be there."', i: 2 },
    { content: '"Restaurant photos on the listing page look amazing, but when you tap into the menu the item photos are tiny thumbnails. There\'s a big drop-off in quality."', i: 2 },
    { content: 'Observed: Sofia rated a restaurant 3 stars after delivery. The review screen had only a star rating and a generic text box. "I wanted to rate the food and delivery separately — I loved the food but the driver was 45 mins late."', i: 2 },
    { content: '"I use Deliveroo Plus but I genuinely forget what benefits I have. I never know which restaurants have the free delivery symbol until I\'m already looking at them."', i: 2 },
    { content: '"The search doesn\'t surface dishes — only restaurants. If I want pad thai I have to know which restaurants serve it. That\'s backwards."', i: 2 },
    { content: '"Group ordering used to be a feature — I swear I used it once — but I can\'t find it anywhere now. My friends and I have to text each other and I manually combine."', i: 2 },
    { content: '"When a restaurant is busy and the wait is long, the app should tell me upfront. Instead I add items, get to checkout, and then see a 75-minute wait."', i: 2 },

    // David Okafor (i=3) — 8 notes
    { content: '"Speed is everything for me at lunchtime. I need to be able to reorder my usual in under 30 seconds. The current flow is about 45 seconds minimum."', i: 3 },
    { content: '"I have three saved addresses — home, office, and a client site. Switching between them is fine but it doesn\'t remember which one I used last."', i: 3 },
    { content: 'Observed: David\'s order was marked "delivered" but hadn\'t arrived. He tapped "help" — the chat bot couldn\'t find his order by reference number. He gave up and called the restaurant directly. "This is unacceptable for a business expense."', i: 3 },
    { content: '"There\'s no way to schedule orders in advance for client lunches. I have to remember to order at 11:30am exactly. I\'ve missed this window twice."', i: 3 },
    { content: '"I\'d pay a premium for a \'guaranteed ETA\' option on business orders. I need to tell a client when food will arrive. The current estimate is useless."', i: 3 },
    { content: '"The expense receipt is a PDF that doesn\'t match our finance system format. My finance team rejects it. I end up manually reformatting every receipt."', i: 3 },
    { content: 'Observed: David tried to add a tip after delivery — he couldn\'t find the option. "I wanted to tip because the driver was excellent in terrible weather. There should be a way."', i: 3 },
    { content: '"When a restaurant cancels my order — which has happened three times — I get a notification but no explanation and no auto-reorder suggestion. I have to start from scratch."', i: 3 },

    // Lily Chen (i=4) — 8 notes
    { content: '"I always look for the promo code box first but sometimes it\'s there and sometimes it isn\'t. I don\'t understand why it disappears."', i: 4 },
    { content: '"The minimum order amount is confusing — sometimes it shows before I pick a restaurant, sometimes only at checkout. I\'ve abandoned orders because of unexpected minimums."', i: 4 },
    { content: 'Observed: Lily tried to split a bill with a flatmate using the app. Found no splitting feature. Said "I thought there was one — my friend mentioned it." Ended up using Monzo to settle afterwards.', i: 4 },
    { content: '"I\'m not sure what the difference between \'estimated\' and \'scheduled\' delivery is. The labels use different words in different places."', i: 4 },
    { content: '"First time I used the app I accidentally ordered to my home address instead of uni. The address picker defaults to the last one used which wasn\'t what I expected."', i: 4 },
    { content: '"The app asks me to rate my order every single time. I find it slightly annoying after the 10th time. I\'d prefer to choose when I want to leave a review."', i: 4 },
    { content: '"When I search for a discount or deal the results mix in full-price restaurants. It\'s hard to tell which ones actually have offers without tapping into each one."', i: 4 },
    { content: 'Observed: Lily noticed her basket had been cleared after she switched to another app briefly. "I had 5 items in there! Why does it do that?" This happened once before and she had abandoned the order entirely.', i: 4 },
  ]

  for (const n of notesData) {
    await client.query(
      `INSERT INTO notes (project_id, interview_id, content, created_by) VALUES ($1,$2,$3,$4)`,
      [projectId, interviewIds[n.i], n.content, userId]
    )
  }
  // Themes, insights, and recommendations are intentionally left empty —
  // the demo starts at the Themes phase so you can show AI clustering,
  // then AI insight and recommendation generation, live.
}

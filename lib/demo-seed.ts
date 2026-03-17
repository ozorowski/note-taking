import { getClient } from './db'

/**
 * Creates a demo project for the given user and returns it.
 * Called automatically on every login so the demo is always fresh.
 *
 * Scenario: Deliveroo usability study — 10 participants, 140 notes.
 * Structured discussion guide with 8 questions across 4 stages + catch-all.
 * Starts at the Themes phase, ready for AI clustering, insight, and recommendation generation.
 */
export async function createDemoProject(userId: string): Promise<{ id: string }> {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Pick a unique title by suffixing (2), (3), … if needed
    const baseTitle = 'Deliveroo App — Usability Study'
    const existingRes = await client.query<{ title: string }>(
      `SELECT title FROM projects p
       JOIN project_memberships pm ON pm.project_id = p.id AND pm.user_id = $1
       WHERE p.title ILIKE $2 OR p.title ILIKE $3`,
      [userId, baseTitle, `${baseTitle} (%)`]
    )
    const taken = new Set(existingRes.rows.map(r => r.title.toLowerCase()))
    let demoTitle = baseTitle
    let suffix = 2
    while (taken.has(demoTitle.toLowerCase())) {
      demoTitle = `${baseTitle} (${suffix++})`
    }

    const projResult = await client.query(
      `INSERT INTO projects (title, description, owner_id, demo, current_phase, has_guide)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        demoTitle,
        'Evaluate the end-to-end ordering experience on the Deliveroo app, from restaurant discovery to order completion, with a focus on task success and user confidence.',
        userId,
        true,
        'themes',
        true,
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
  // ── 10 participants ────────────────────────────────────────────────────────
  const interviews = [
    {
      name: 'Emma Thompson',
      notes: 'Age 27, marketing manager, orders 3–4x per week. iPhone. Very comfortable with tech. Main use case: solo weeknight dinners. 3 years on Deliveroo.',
    },
    {
      name: 'James Wilson',
      notes: 'Age 38, parent of two, orders for family meals 1–2x per week. Android. Moderate tech confidence. Often ordering for multiple people with dietary requirements.',
    },
    {
      name: 'Sofia Martinez',
      notes: 'Age 24, food blogger, orders 5+ times per week. Power user, Deliveroo Plus subscriber. Very opinionated about discovery experience.',
    },
    {
      name: 'David Okafor',
      notes: 'Age 45, consultant. Orders for work lunches 2–3x per week. Values speed and reliability above all. Uses saved addresses and payment methods heavily.',
    },
    {
      name: 'Lily Chen',
      notes: 'Age 21, university student. New Deliveroo user — only 2 months in. Budget-conscious, uses promo codes frequently. Finds the app occasionally confusing.',
    },
    {
      name: 'Priya Sharma',
      notes: 'Age 32, UX designer at a fintech startup. Orders 2–3x per week, often lunch alone. Critical eye for UI patterns. Uses both Deliveroo and Uber Eats weekly and compares them constantly.',
    },
    {
      name: 'Marcus Johnson',
      notes: 'Age 41, secondary school teacher. Orders Friday takeaways as a family treat. Low-frequency user — once a week at most. Prioritises value for money and reliability.',
    },
    {
      name: 'Helen Brooks',
      notes: 'Age 58, GP (doctor). Orders when on call or working late. Values speed and healthy options. Considers herself a late adopter of food delivery apps — started using Deliveroo 6 months ago.',
    },
    {
      name: 'Tariq Ahmed',
      notes: 'Age 29, software engineer. Heavy user — orders almost daily. Uses multiple platforms and switches based on promotions. Knows the Deliveroo app inside out but has strong opinions about its shortcomings.',
    },
    {
      name: 'Chloe Dupont',
      notes: 'Age 35, remote worker. Orders lunch 4–5x per week to avoid cooking. Has a very set routine and reorders the same restaurants. Interrupted during the session twice by work Slack messages.',
    },
  ]

  const interviewIds: string[] = []
  for (let idx = 0; idx < interviews.length; idx++) {
    const iv = interviews[idx]
    const r = await client.query(
      `INSERT INTO interviews (project_id, participant_name, raw_notes, created_by, display_number) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [projectId, iv.name, iv.notes, userId, idx + 1]
    )
    interviewIds.push(r.rows[0].id)
  }

  // ── 8 guide questions across 4 stages + catch-all ─────────────────────────
  // q0–q1: Warm-up | q2–q3: Discovery & Search | q4–q5: Ordering & Checkout
  // q6–q7: Delivery & Post-order | q8: Other observation (catch-all)
  const questionDefs = [
    { text: 'Tell me about the last time you ordered through Deliveroo. Walk me through what you did.', stage_label: 'Warm-up', order_index: 0, is_catch_all: false },
    { text: 'How often do you use food delivery apps, and how does Deliveroo compare to others?', stage_label: 'Warm-up', order_index: 1, is_catch_all: false },
    { text: 'Show me how you\'d find somewhere to order from right now — think aloud as you go.', stage_label: 'Discovery & Search', order_index: 2, is_catch_all: false },
    { text: 'Have you ever struggled to find what you were looking for? What happened?', stage_label: 'Discovery & Search', order_index: 3, is_catch_all: false },
    { text: 'Walk me through placing an order — from picking a restaurant to hitting confirm.', stage_label: 'Ordering & Checkout', order_index: 4, is_catch_all: false },
    { text: 'Have you ever abandoned an order partway through? What caused that?', stage_label: 'Ordering & Checkout', order_index: 5, is_catch_all: false },
    { text: 'What happens after you place an order? What do you check or do while waiting?', stage_label: 'Delivery & Post-order', order_index: 6, is_catch_all: false },
    { text: 'Have you ever had a problem with a delivery — wrong item, late, missing? What did you do?', stage_label: 'Delivery & Post-order', order_index: 7, is_catch_all: false },
    { text: 'Other observation', stage_label: null, order_index: 8, is_catch_all: true },
  ]

  const questionIds: string[] = []
  for (const q of questionDefs) {
    const r = await client.query(
      `INSERT INTO guide_questions (project_id, text, stage_label, order_index, is_catch_all) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [projectId, q.text, q.stage_label, q.order_index, q.is_catch_all]
    )
    questionIds.push(r.rows[0].id)
  }

  // Convenience: q[n] = questionIds[n]
  const q = questionIds

  // ── 140 notes spread across 10 participants ────────────────────────────────
  // Format: { content, i (interview index 0-9), qi (question index 0-8), evidence_type }
  type NoteRow = { content: string; i: number; qi: number; evidence_type: string }
  const notesData: NoteRow[] = [
    // ── Emma Thompson (i=0) — 14 notes ──────────────────────────────────────
    { content: '"Last time I ordered I did the whole thing on autopilot — opened the app, tapped my usual, checked out in under two minutes. It was a Monday night, I wanted Thai, I didn\'t want to think."', i: 0, qi: 0, evidence_type: 'quote' },
    { content: 'Emma described her typical ordering session as "muscle memory" — she rarely browses and almost always reorders.', i: 0, qi: 0, evidence_type: 'observation' },
    { content: '"I use Deliveroo almost every weeknight. I used to use Uber Eats but Deliveroo felt faster in my area. The restaurant selection is better too."', i: 0, qi: 1, evidence_type: 'quote' },
    { content: '"I just type what I fancy into search — but the results feel random. Sometimes a pizza place comes up when I search for sushi."', i: 0, qi: 2, evidence_type: 'pain_point' },
    { content: 'Observed: Emma tapped the search bar, typed "Thai", scrolled past 6 sponsored results before finding an organic one. Said "these sponsored ones are annoying."', i: 0, qi: 2, evidence_type: 'observation' },
    { content: '"The filters are buried. I always forget where they are and end up scrolling past places I can\'t eat at."', i: 0, qi: 3, evidence_type: 'pain_point' },
    { content: '"I wish I could save filter presets — I always want the same things: under 30 min, no minimum order, 4 stars or above."', i: 0, qi: 3, evidence_type: 'need' },
    { content: '"Reordering is the feature I use most. But sometimes it fails silently — I don\'t realise an item is unavailable until checkout."', i: 0, qi: 4, evidence_type: 'pain_point' },
    { content: 'Observed: Emma tried to customise a burger — she missed the "required" modifier step and the app blocked her at checkout without a clear error message. Took 90 seconds to find and fix it.', i: 0, qi: 4, evidence_type: 'observation' },
    { content: '"Once I nearly placed a £45 order to the wrong address. The delivery address confirmation at checkout is so small I almost missed it."', i: 0, qi: 5, evidence_type: 'pain_point' },
    { content: '"The ETA shown on the restaurant page is never what I actually get. I\'ve stopped trusting it — I just assume add 15 minutes."', i: 0, qi: 6, evidence_type: 'pain_point' },
    { content: '"I love the live tracking map but it disappears sometimes. Once it just said \'your order is on its way\' for 40 minutes with no map."', i: 0, qi: 6, evidence_type: 'pain_point' },
    { content: '"A driver once left my food at the wrong flat and marked it as delivered. The chat bot couldn\'t help — I had to call the restaurant myself."', i: 0, qi: 7, evidence_type: 'quote' },
    { content: '"When I get a refund it just appears as credit. I\'d prefer it back to my card — I forget the credit is there and it expires."', i: 0, qi: 7, evidence_type: 'need' },

    // ── James Wilson (i=1) — 14 notes ────────────────────────────────────────
    { content: '"Last order was a Saturday family dinner. I spent about 20 minutes choosing — everyone wanted something different. Ended up doing two separate restaurants."', i: 1, qi: 0, evidence_type: 'observation' },
    { content: '"I order once or twice a week, always for the whole family. Deliveroo is our go-to but Uber Eats sometimes has better offers."', i: 1, qi: 1, evidence_type: 'quote' },
    { content: '"Ordering for a family is a nightmare. There\'s no way to organise the basket by person. I have to scroll up and down constantly to check what I\'ve added."', i: 1, qi: 2, evidence_type: 'pain_point' },
    { content: '"The dietary filter options are too basic — there\'s no \'nut-free\' option and my daughter has a nut allergy. I have to read every item description manually."', i: 1, qi: 3, evidence_type: 'need' },
    { content: 'Observed: James spent 4 minutes searching for allergen information on a dish. Eventually found a small "contains" list in grey text at the bottom of the item description. "This should be front and centre."', i: 1, qi: 3, evidence_type: 'observation' },
    { content: '"The \'popular items\' section is useful but I always wonder — popular with who? Is it popular in my area? This week? Ever?"', i: 1, qi: 4, evidence_type: 'quote' },
    { content: 'Observed: James tried to apply a promo code at checkout — the field was hidden inside an "offers" accordion that he didn\'t notice for 2 minutes. "I nearly missed it."', i: 1, qi: 4, evidence_type: 'observation' },
    { content: '"Comparing restaurants is hard — I have to open each one, check the menu and prices, go back, open another. There\'s no side-by-side view."', i: 1, qi: 5, evidence_type: 'need' },
    { content: '"When I add a note to the order like \'no onions\', I have no idea if the restaurant actually sees it. I\'ve had onions every time."', i: 1, qi: 5, evidence_type: 'pain_point' },
    { content: '"I screenshot the order confirmation now, because I\'ve had disputes where Deliveroo\'s system showed something different from what I remembered."', i: 1, qi: 6, evidence_type: 'observation' },
    { content: '"I\'ve had three orders where an item went missing and the refund process took over a week. Now I take a photo of the bag when it arrives."', i: 1, qi: 7, evidence_type: 'pain_point' },
    { content: '"Once an entire order was wrong — completely different food. The help flow made me answer 7 questions before I could report it."', i: 1, qi: 7, evidence_type: 'pain_point' },
    { content: '"My kids have started using the app themselves on an iPad. The font is too small for them and there\'s no parental control on spending limits."', i: 1, qi: 8, evidence_type: 'need' },
    { content: '"The \'group order\' prompt appeared once but I couldn\'t figure out how to use it properly — it wasn\'t clear how others would join."', i: 1, qi: 8, evidence_type: 'observation' },

    // ── Sofia Martinez (i=2) — 14 notes ──────────────────────────────────────
    { content: '"Last time I ordered I tried a new Korean place that opened nearby. I specifically hunted for it — it wasn\'t showing in the cuisine browse, I had to search the restaurant name."', i: 2, qi: 0, evidence_type: 'observation' },
    { content: '"I order at least once a day, sometimes twice. Deliveroo has the widest range in my area. Uber Eats is better for chains but Deliveroo wins for independents."', i: 2, qi: 1, evidence_type: 'quote' },
    { content: '"Discovery is the weakest part of the app. I know what cuisines I want to explore but there\'s no way to browse by ingredient or cooking style — only by cuisine category."', i: 2, qi: 2, evidence_type: 'pain_point' },
    { content: '"The search doesn\'t surface dishes — only restaurants. If I want pad thai I have to know which restaurants serve it. That\'s backwards."', i: 2, qi: 2, evidence_type: 'pain_point' },
    { content: '"Restaurant photos on the listing page look amazing, but when you tap into the menu the item photos are tiny thumbnails. There\'s a big drop-off in quality."', i: 2, qi: 3, evidence_type: 'observation' },
    { content: '"The \'new restaurants\' section is great when it appears — but it only shows up sometimes. I don\'t know when it\'ll be there or what triggers it."', i: 2, qi: 3, evidence_type: 'quote' },
    { content: '"I use Deliveroo Plus but I genuinely forget what benefits I have. I never know which restaurants have the free delivery symbol until I\'m already looking at them."', i: 2, qi: 4, evidence_type: 'pain_point' },
    { content: '"When a restaurant is busy and the wait is long, the app should tell me upfront. Instead I add items, get to checkout, and then see a 75-minute wait."', i: 2, qi: 5, evidence_type: 'need' },
    { content: '"Group ordering used to be a feature — I swear I used it once — but I can\'t find it anywhere now."', i: 2, qi: 5, evidence_type: 'pain_point' },
    { content: 'Observed: Sofia rated a restaurant 3 stars after delivery. The review screen had only a star rating and a generic text box. "I wanted to rate the food and delivery separately — I loved the food but the driver was 45 mins late."', i: 2, qi: 6, evidence_type: 'observation' },
    { content: '"The ETA countdown is the main thing I watch after ordering. It\'s calming when it moves in real time but I\'ve seen it jump from 10 min to 30 min with no explanation."', i: 2, qi: 6, evidence_type: 'quote' },
    { content: '"I reported a wrong item and got a credit immediately — that was good. But the credit didn\'t cover the price difference, it was a flat amount."', i: 2, qi: 7, evidence_type: 'pain_point' },
    { content: '"I\'d love curated \'editor\' picks from local food journalists. Right now the algorithm recommendations feel generic."', i: 2, qi: 8, evidence_type: 'need' },
    { content: '"The app is never wrong about restaurant hours — that\'s one thing it does well. I\'ve never tried to order from somewhere closed."', i: 2, qi: 8, evidence_type: 'observation' },

    // ── David Okafor (i=3) — 14 notes ────────────────────────────────────────
    { content: '"This morning I ordered a salad for a client lunch. I did it in under a minute because I had everything saved. That\'s the experience I need every time."', i: 3, qi: 0, evidence_type: 'quote' },
    { content: '"I need it to be fast. I order on Deliveroo almost daily for work. When I\'m comparing, Deliveroo and Uber Eats are neck and neck — I go with whoever has a promo."', i: 3, qi: 1, evidence_type: 'quote' },
    { content: '"I have three saved addresses — home, office, and a client site. Switching between them is fine but it doesn\'t remember which one I used last at what time of day."', i: 3, qi: 2, evidence_type: 'pain_point' },
    { content: '"Speed is everything for me at lunchtime. I need to be able to reorder my usual in under 30 seconds. The current flow is about 45 seconds minimum."', i: 3, qi: 2, evidence_type: 'need' },
    { content: '"There\'s no way to schedule orders in advance for client lunches. I have to remember to order at 11:30am exactly. I\'ve missed this window twice."', i: 3, qi: 3, evidence_type: 'need' },
    { content: '"I\'d pay a premium for a \'guaranteed ETA\' option on business orders. I need to tell a client when food will arrive. The current estimate is useless."', i: 3, qi: 4, evidence_type: 'need' },
    { content: '"The expense receipt is a PDF that doesn\'t match our finance system format. My finance team rejects it. I end up manually reformatting every receipt."', i: 3, qi: 4, evidence_type: 'pain_point' },
    { content: '"When I add an item at checkout it sometimes resets the whole basket. I lost a 12-item order once because I tried to add a drink."', i: 3, qi: 5, evidence_type: 'pain_point' },
    { content: '"The checkout confirmation page is cluttered. There\'s upsell, there\'s a tip prompt, there\'s a charity donation ask. I just want to see what I ordered and confirm."', i: 3, qi: 5, evidence_type: 'observation' },
    { content: 'Observed: David tried to add a tip after delivery — he couldn\'t find the option. "I wanted to tip because the driver was excellent in terrible weather."', i: 3, qi: 6, evidence_type: 'observation' },
    { content: 'Observed: David\'s order was marked "delivered" but hadn\'t arrived. He tapped "help" — the chat bot couldn\'t find his order by reference number. He gave up and called the restaurant directly. "This is unacceptable for a business expense."', i: 3, qi: 7, evidence_type: 'observation' },
    { content: '"When a restaurant cancels my order — which has happened three times — I get a notification but no explanation and no auto-reorder suggestion. I have to start from scratch."', i: 3, qi: 7, evidence_type: 'pain_point' },
    { content: '"There should be a \'business account\' mode with VAT receipts, consolidated billing, and a spend dashboard. That would make Deliveroo my permanent work tool."', i: 3, qi: 8, evidence_type: 'need' },
    { content: '"I appreciate the driver rating system. I always rate 5 stars unless something went wrong — I feel bad rating lower."', i: 3, qi: 8, evidence_type: 'observation' },

    // ── Lily Chen (i=4) — 14 notes ────────────────────────────────────────────
    { content: '"Last time I ordered pizza with my flatmates. I put in the order but had to Monzo request them after because there\'s no bill-splitting."', i: 4, qi: 0, evidence_type: 'observation' },
    { content: '"I\'m on Deliveroo maybe two or three times a week. My friends use it more. I switched from Uber Eats because Deliveroo had a student promo."', i: 4, qi: 1, evidence_type: 'quote' },
    { content: 'Observed: Lily tried to split a bill with a flatmate using the app. Found no splitting feature. Ended up using Monzo to settle afterwards. "I thought there was one — my friend mentioned it."', i: 4, qi: 2, evidence_type: 'observation' },
    { content: '"I always look for the promo code box first but sometimes it\'s there and sometimes it isn\'t. I don\'t understand why it disappears."', i: 4, qi: 2, evidence_type: 'pain_point' },
    { content: '"The minimum order amount is confusing — sometimes it shows before I pick a restaurant, sometimes only at checkout. I\'ve abandoned orders because of unexpected minimums."', i: 4, qi: 3, evidence_type: 'pain_point' },
    { content: '"When I search for a discount or deal the results mix in full-price restaurants. It\'s hard to tell which ones actually have offers without tapping into each one."', i: 4, qi: 3, evidence_type: 'pain_point' },
    { content: '"The checkout is fine once you know the flow. My first time I accidentally tipped £10 — I didn\'t realise the tip slider was there until I\'d confirmed."', i: 4, qi: 4, evidence_type: 'pain_point' },
    { content: '"First time I used the app I accidentally ordered to my home address instead of uni. The address picker defaults to the last one used which wasn\'t what I expected."', i: 4, qi: 5, evidence_type: 'pain_point' },
    { content: '"I\'m not sure what the difference between \'estimated\' and \'scheduled\' delivery is. The labels use different words in different places."', i: 4, qi: 5, evidence_type: 'pain_point' },
    { content: '"The app asks me to rate my order every single time. I find it slightly annoying after the 10th time. I\'d prefer to choose when I want to leave a review."', i: 4, qi: 6, evidence_type: 'pain_point' },
    { content: 'Observed: Lily noticed her basket had been cleared after she switched to another app briefly. "I had 5 items in there! Why does it do that?" This happened once before and she abandoned the order entirely.', i: 4, qi: 6, evidence_type: 'observation' },
    { content: '"A restaurant sent the wrong order once. I contacted support and they gave me a voucher but I don\'t know where to find it now."', i: 4, qi: 7, evidence_type: 'pain_point' },
    { content: '"The order history page is useful — I go back to see what I liked. But the photos aren\'t shown in the history, just a text list."', i: 4, qi: 8, evidence_type: 'need' },
    { content: '"I\'ve started checking the restaurant\'s Google rating before ordering, because the Deliveroo rating feels unreliable — same restaurant has 4.8 on Deliveroo and 3.9 on Google."', i: 4, qi: 8, evidence_type: 'observation' },

    // ── Priya Sharma (i=5) — 14 notes ────────────────────────────────────────
    { content: '"Yesterday I ordered a curry for a working lunch. Took me less than three minutes — I\'ve got my regular restaurants pinned."', i: 5, qi: 0, evidence_type: 'quote' },
    { content: '"I use Deliveroo for lunch almost every day. Uber Eats has a better interface honestly, but Deliveroo has better coverage in this part of London."', i: 5, qi: 1, evidence_type: 'observation' },
    { content: 'Observed: Priya navigated to the homepage and immediately went to Favourites — bypassed browse entirely. "I almost never browse. If I want something new I search."', i: 5, qi: 2, evidence_type: 'observation' },
    { content: '"The information hierarchy on the restaurant card is wrong — the restaurant name and rating are the same size. I want the rating much bigger."', i: 5, qi: 2, evidence_type: 'pain_point' },
    { content: '"I\'ve noticed the ETA shown on the listing page never matches checkout. It feels dishonest — they\'re showing the best-case time to get me to tap."', i: 5, qi: 3, evidence_type: 'pain_point' },
    { content: '"The \'for you\' section on the home screen is surprisingly good — it surfaces places I wouldn\'t think to search for. Better than I expected from an algorithm."', i: 5, qi: 3, evidence_type: 'quote' },
    { content: '"Adding modifiers is fine when you know what to look for. But the visual design doesn\'t make required vs optional modifiers clear — same style, different consequence."', i: 5, qi: 4, evidence_type: 'observation' },
    { content: '"I\'ve accidentally confirmed orders twice by tapping too fast. The final checkout button is too close to the tip section and I was scrolling."', i: 5, qi: 5, evidence_type: 'pain_point' },
    { content: '"I\'d love a \'confirm on tap\' toggle or a 3-second delay on the order button — something to prevent accidental orders."', i: 5, qi: 5, evidence_type: 'need' },
    { content: '"The live tracking is the best part of the experience. I feel genuinely anxious when it disappears and the \'preparing\' state lasts more than 10 minutes."', i: 5, qi: 6, evidence_type: 'quote' },
    { content: '"I watch the driver approach on the map. When they stop near me but the app still says \'arriving\', I go to the door preemptively. I\'ve never been wrong."', i: 5, qi: 6, evidence_type: 'observation' },
    { content: '"I had an item missing once. Reported it immediately, got credit in 5 minutes. That was genuinely impressive."', i: 5, qi: 7, evidence_type: 'quote' },
    { content: '"On another occasion I got the wrong cuisine entirely — a Chinese when I ordered Indian. Reporting that was harder. The help bot was useless and I had to email."', i: 5, qi: 7, evidence_type: 'pain_point' },
    { content: '"The dark pattern with the tip slider defaulting to 20% bothers me as a designer. Users who don\'t notice will tip more than intended."', i: 5, qi: 8, evidence_type: 'observation' },

    // ── Marcus Johnson (i=6) — 14 notes ──────────────────────────────────────
    { content: '"We do a Friday takeaway — it\'s become a ritual. Last week was Indian, the week before was pizza. The kids choose."', i: 6, qi: 0, evidence_type: 'quote' },
    { content: '"Maybe once a week. We also use Just Eat — sometimes it has different restaurants. Deliveroo feels more premium but also pricier."', i: 6, qi: 1, evidence_type: 'quote' },
    { content: '"I browse by cuisine — I don\'t really search. I tap \'Indian\' or \'Pizza\' and scroll until something looks good."', i: 6, qi: 2, evidence_type: 'observation' },
    { content: '"The photos are what sell it for me. Good photo, I\'ll consider it. No photo or a blurry one, I skip it."', i: 6, qi: 2, evidence_type: 'quote' },
    { content: '"I can never remember if a restaurant has been good or bad — the ratings are too high across the board. Everything is 4.5 or above."', i: 6, qi: 3, evidence_type: 'pain_point' },
    { content: '"I wish I could see previous orders from a restaurant before committing — to remind myself if it was good last time."', i: 6, qi: 3, evidence_type: 'need' },
    { content: '"Checkout is straightforward. I just want to see the total before tipping — sometimes the tip is calculated on the subtotal including delivery, which feels cheeky."', i: 6, qi: 4, evidence_type: 'pain_point' },
    { content: '"I always remove the default tip and set my own. Not because I\'m mean — I just want to choose, not have it chosen for me."', i: 6, qi: 4, evidence_type: 'observation' },
    { content: '"I\'ve only abandoned one order — when the restaurant added a 50p surcharge that wasn\'t mentioned anywhere and I only noticed at the very last screen."', i: 6, qi: 5, evidence_type: 'pain_point' },
    { content: '"I like the order tracking page but my kids always want to look at it. I\'d like a simplified \'kid view\' with just the map and a big \'X minutes away\' counter."', i: 6, qi: 6, evidence_type: 'need' },
    { content: '"Once the driver called because he couldn\'t find the door. The call came from a withheld number so I didn\'t answer — food went cold while I waited."', i: 6, qi: 7, evidence_type: 'observation' },
    { content: '"I\'ve never had a major issue. Minor ones — like missing a sauce — I don\'t bother reporting because it feels like too much effort for too little return."', i: 6, qi: 7, evidence_type: 'observation' },
    { content: '"I\'d love a \'family meal deal\' filter — 4 mains and 4 sides under £40, delivered together. The current search doesn\'t help you think about value in that way."', i: 6, qi: 8, evidence_type: 'need' },
    { content: '"The Deliveroo branding feels trustworthy. I\'d use a less-branded competitor if the price was right, but the teal colour makes me feel like it\'s legit."', i: 6, qi: 8, evidence_type: 'observation' },

    // ── Helen Brooks (i=7) — 14 notes ────────────────────────────────────────
    { content: '"I usually order when I\'m working late. Last time was a Thursday on-call shift — I just wanted something hot and quick. I think it took 35 minutes."', i: 7, qi: 0, evidence_type: 'quote' },
    { content: '"I only started about six months ago. A colleague recommended it. I\'m not a big tech person — I find the app a bit overwhelming sometimes."', i: 7, qi: 1, evidence_type: 'quote' },
    { content: 'Observed: Helen scrolled past the cuisine filter strip without engaging with it. She went straight to scrolling the main feed. Did not use search at all.', i: 7, qi: 2, evidence_type: 'observation' },
    { content: '"I just scroll until something catches my eye. I don\'t know how to use the filters properly and I\'m worried I\'ll break something if I tap the wrong thing."', i: 7, qi: 2, evidence_type: 'quote' },
    { content: '"I wish there was a simpler view — just a list of restaurants near me sorted by star rating. All these sections and categories are confusing."', i: 7, qi: 3, evidence_type: 'need' },
    { content: '"I tried to search \'healthy\' once and got no results. I thought I was doing something wrong."', i: 7, qi: 3, evidence_type: 'pain_point' },
    { content: 'Observed: Helen added an item to her basket then looked confused when she couldn\'t find a "next" button. She swiped around for 15 seconds before spotting the floating basket pill at the bottom.', i: 7, qi: 4, evidence_type: 'observation' },
    { content: '"The basket is confusing. I couldn\'t tell I\'d added something until I noticed the teal bubble at the bottom. It should say something obvious like \'Your order\'."', i: 7, qi: 4, evidence_type: 'pain_point' },
    { content: '"I\'ve never abandoned an order. Once I start I just go through to the end — I\'m too nervous to start again."', i: 7, qi: 5, evidence_type: 'quote' },
    { content: '"I check the app maybe three times while I\'m waiting. I like seeing the little motorbike on the map — it makes me feel like someone\'s coming."', i: 7, qi: 6, evidence_type: 'quote' },
    { content: '"The estimated time went up from 20 to 40 minutes mid-order. That was stressful. I didn\'t know if something had gone wrong."', i: 7, qi: 6, evidence_type: 'pain_point' },
    { content: '"I had my soup spilled once — the bag wasn\'t sealed properly. I took a photo and contacted support. They gave me a refund but it took me a while to find where to report it."', i: 7, qi: 7, evidence_type: 'pain_point' },
    { content: '"I\'d like a \'less choice\' mode. Maybe 10 curated options based on my location and what\'s popular tonight. I don\'t need 200 restaurants."', i: 7, qi: 8, evidence_type: 'need' },
    { content: '"I appreciate the contactless delivery option — I always choose \'leave at door\'. That\'s the feature I use most consciously."', i: 7, qi: 8, evidence_type: 'quote' },

    // ── Tariq Ahmed (i=8) — 14 notes ──────────────────────────────────────────
    { content: '"Yesterday I ordered from three different restaurants in the same day — breakfast, lunch, and dinner. I\'m probably your heaviest user."', i: 8, qi: 0, evidence_type: 'quote' },
    { content: '"I\'ve tried every platform. Deliveroo is the most consistent in London. Uber Eats has better promos. Just Eat is too slow. I use Deliveroo as my default."', i: 8, qi: 1, evidence_type: 'quote' },
    { content: '"I can find anything — I know the app inside out. But that knowledge took months to build. A new user would be lost."', i: 8, qi: 2, evidence_type: 'observation' },
    { content: '"The cuisine filter is too high-level. \'Asian\' as a category is doing a lot of heavy lifting — it covers Japanese, Thai, Korean, Vietnamese. They\'re completely different."', i: 8, qi: 2, evidence_type: 'pain_point' },
    { content: '"The sorting options are inadequate. \'Relevance\' is meaningless — I want to sort by actual delivery time, not estimated time."', i: 8, qi: 3, evidence_type: 'pain_point' },
    { content: '"I\'ve noticed that if I search the same thing twice, the results come back in a different order. There\'s clearly randomness in the ranking algorithm."', i: 8, qi: 3, evidence_type: 'observation' },
    { content: '"Checkout is fine. My only gripe is that the \'order now\' button is the same style as \'continue shopping\' — there\'s no visual hierarchy to make the primary action obvious."', i: 8, qi: 4, evidence_type: 'observation' },
    { content: '"I\'ve started screenshotting my basket before checkout because I\'ve had the price change between adding to basket and confirming. Hidden surcharges appear late."', i: 8, qi: 4, evidence_type: 'pain_point' },
    { content: '"I abandoned an order last month when a restaurant showed a 90-minute wait at checkout. That information should have been shown before I built a basket."', i: 8, qi: 5, evidence_type: 'pain_point' },
    { content: '"I watch the tracking more than I should. The \'driver collected\' notification is the one I wait for — after that I know it\'s happening."', i: 8, qi: 6, evidence_type: 'quote' },
    { content: '"Push notifications have a bug where I sometimes get two \'order delivered\' pings. It\'s minor but it makes me check the app unnecessarily."', i: 8, qi: 6, evidence_type: 'observation' },
    { content: '"I\'ve had maybe 15 issues in two years of daily ordering — that\'s a low error rate. Most were resolved quickly. Two were not: both involved driver no-shows."', i: 8, qi: 7, evidence_type: 'observation' },
    { content: '"The \'report a problem\' flow is designed to deter you. Every step has a \'are you sure?\' or \'the restaurant may dispute this\' warning."', i: 8, qi: 7, evidence_type: 'pain_point' },
    { content: '"I\'d pay for a subscription that includes a \'priority queue\' for driver assignment at peak hours. Riders always seem to go to the nearby orders first."', i: 8, qi: 8, evidence_type: 'need' },

    // ── Chloe Dupont (i=9) — 14 notes ────────────────────────────────────────
    { content: '"Every weekday I order the same lunch. I have a routine — same restaurant, same items. I think I\'ve ordered from them over 80 times."', i: 9, qi: 0, evidence_type: 'quote' },
    { content: '"I use it almost every day for lunch. I tried Uber Eats once but my favourite restaurant wasn\'t on there. So I came back."', i: 9, qi: 1, evidence_type: 'quote' },
    { content: 'Observed: Chloe opened the app and went immediately to order history, tapped the restaurant, and reordered. Total time: 22 seconds. No browsing at all.', i: 9, qi: 2, evidence_type: 'observation' },
    { content: '"I never browse. Everything I need is in my order history. If that feature disappeared I\'d probably stop using the app."', i: 9, qi: 2, evidence_type: 'quote' },
    { content: '"The one time I tried to find something new was after my go-to restaurant closed for refurbishment. I spent 10 minutes scrolling and gave up — ordered from Pret instead."', i: 9, qi: 3, evidence_type: 'pain_point' },
    { content: '"If Deliveroo knew my history, it should suggest \'similar restaurants\' when my usual is unavailable. It doesn\'t do that."', i: 9, qi: 3, evidence_type: 'need' },
    { content: '"Checkout is automatic for me. Saved address, saved card, no tip changes. The system remembers everything. That\'s the one thing I love unconditionally."', i: 9, qi: 4, evidence_type: 'quote' },
    { content: '"Once the payment failed silently — the order looked placed but I got no confirmation email. I only realised 40 minutes later when nothing arrived."', i: 9, qi: 5, evidence_type: 'pain_point' },
    { content: '"I don\'t abandon orders. If I\'ve opened the app, I\'m ordering. The only exception was when my internet dropped mid-checkout and I wasn\'t sure if it went through."', i: 9, qi: 5, evidence_type: 'observation' },
    { content: '"I don\'t really watch the tracking. I wait 30 minutes then go to the door. Usually the food is there or nearly there."', i: 9, qi: 6, evidence_type: 'observation' },
    { content: '"I got an \'order delayed\' notification once with no ETA update. It said \'sorry for the wait\' but gave me no new information. I had a meeting in 20 minutes — I needed to know."', i: 9, qi: 6, evidence_type: 'pain_point' },
    { content: '"Never had a wrong order. Once had a very late one — 75 minutes for a 25-minute order. No compensation offered unless I requested it, which I didn\'t know I could."', i: 9, qi: 7, evidence_type: 'pain_point' },
    { content: '"I\'d love a \'regular customer\' badge or loyalty feature. I order from the same place constantly — they should know me by now."', i: 9, qi: 8, evidence_type: 'need' },
    { content: '"The app never crashes for me. That\'s genuinely impressive given how often I use it. Performance is not the problem — it\'s the experience around it."', i: 9, qi: 8, evidence_type: 'observation' },
  ]

  for (let idx = 0; idx < notesData.length; idx++) {
    const n = notesData[idx]
    await client.query(
      `INSERT INTO notes (project_id, interview_id, content, created_by, evidence_type, visibility, guide_question_id, display_number)
       VALUES ($1,$2,$3,$4,$5,'shared',$6,$7)`,
      [projectId, interviewIds[n.i], n.content, userId, n.evidence_type, q[n.qi], idx + 1]
    )
  }

  // Themes, insights, and recommendations are intentionally left empty —
  // the demo starts at the Themes phase so you can show AI clustering,
  // then AI insight and recommendation generation, live.
}

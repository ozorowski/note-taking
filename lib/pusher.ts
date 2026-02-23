import Pusher from 'pusher'

const pusher =
  process.env.PUSHER_APP_ID &&
  process.env.NEXT_PUBLIC_PUSHER_APP_KEY &&
  process.env.PUSHER_SECRET &&
  process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    ? new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
        useTLS: true,
      })
    : null

export async function broadcastProjectUpdate(projectId: string) {
  if (!pusher) return
  try {
    await pusher.trigger(`project-${projectId}`, 'project-updated', {})
  } catch {
    // Non-fatal — polling will catch up
  }
}

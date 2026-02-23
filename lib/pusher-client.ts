import PusherClient from 'pusher-js'

let instance: PusherClient | null = null

function getClient(): PusherClient | null {
  if (typeof window === 'undefined') return null
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  if (!key || !cluster) return null
  if (!instance) {
    instance = new PusherClient(key, { cluster })
  }
  return instance
}

export function subscribeToProject(projectId: string, onUpdate: () => void): () => void {
  const client = getClient()
  if (!client) return () => {}
  const channel = client.subscribe(`project-${projectId}`)
  channel.bind('project-updated', onUpdate)
  return () => {
    channel.unbind('project-updated', onUpdate)
    client.unsubscribe(`project-${projectId}`)
  }
}

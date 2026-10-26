const CLIENT_ID_PATTERN = /^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/

export function inspectClientId(value) {
  const clientId = String(value ?? '').trim()

  if (!clientId || clientId === 'your-client-id.apps.googleusercontent.com') {
    return { ok: false, reason: 'missing' }
  }

  if (
    clientId.startsWith('GOCSPX-') ||
    /client_secret/i.test(clientId) ||
    clientId.includes('private_key') ||
    clientId.includes('BEGIN PRIVATE KEY')
  ) {
    return { ok: false, reason: 'secret' }
  }

  if (!CLIENT_ID_PATTERN.test(clientId)) {
    return { ok: false, reason: 'invalid' }
  }

  return { ok: true, clientId }
}

export function clientIdMessage(reason) {
  if (reason === 'secret') {
    return 'That value is a client secret, not a client ID. Remove it. Row One only accepts the public Web client ID ending in .apps.googleusercontent.com.'
  }
  if (reason === 'invalid') {
    return 'The client ID should be the Web client ID from Google Cloud and end in .apps.googleusercontent.com.'
  }
  return 'Add your browser OAuth client ID before signing in.'
}

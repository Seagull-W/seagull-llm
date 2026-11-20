import { createRemoteJWKSet, jwtVerify } from 'jose'

type AccessEnv = { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; NOTES_OWNER_EMAILS?: string }
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export async function isOwner(request: Request, env: AccessEnv) {
  const domain = env.ACCESS_TEAM_DOMAIN
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token || !domain || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) ||
      !env.ACCESS_AUD || !env.NOTES_OWNER_EMAILS) return false
  const issuer = 'https://' + domain
  let keys = keySets.get(issuer)
  if (!keys) {
    keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer))
    keySets.set(issuer, keys)
  }
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'sub', 'email']
    })
    const email = payload.email
    return typeof email === 'string' && email.length > 0 && env.NOTES_OWNER_EMAILS.split(',')
      .some(allowed => allowed.trim().toLowerCase() === email.toLowerCase())
  } catch { return false }
}

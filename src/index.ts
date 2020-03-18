import ClientOAuth2 from "client-oauth2"
import got from "got"
interface CfLink {
  href: string
  method?: string
  meta?: { [key: string]: string }
}
const isCfLink = (x: any): x is CfLink => !!x?.href
export interface CfInfo {
  guid?: string
  created_at?: Date
  updated_at?: Date
  links: { [key: string]: CfLink | null }
}
const isCfInfo = (x: any): x is CfInfo => {
  let result = !!x.links
  if (result)
    for (const k in x.links)
      if (!(x.links[k] === null || isCfLink(x.links[k]))) {
        result = false
        break
      }
  return result
}

export interface UaaTokenKeys {
  kid: string // Key ID of key to be used for verification of the token.
  alg: string // Encryption algorithm
  value: string // Verifier key
  kty: string // Key type (RSA)
  use: string // Public key use parameter - identifies intended use of the public key. (defaults to "sig")
  n: string // RSA key modulus
  e: string // RSA key public exponent
}
const isUaaTokenKeys = (x: UaaTokenKeys): x is UaaTokenKeys =>
  !!(x?.kid && x?.value && x?.alg && x?.kty)

export async function cfInfo(cfEndPoint: string) {
  const headers = { Accept: "application/json" }
  const resp = await got(cfEndPoint, { headers })

  const info = JSON.parse(resp.body)
  if (!isCfInfo(info)) throw new Error("Failed to retrieve CloufFoundry info")
  return info
}

export async function cfTokenKeys(uaaLoginEndPoint: string) {
  const headers = { Accept: "application/json" }
  const resp = await got(`${uaaLoginEndPoint}/token_keys`, { headers })
  const keys = JSON.parse(resp.body)?.keys
  if (!Array.isArray(keys) || !keys.every(isUaaTokenKeys))
    throw new Error("Failed to retrieve token keys")
  return keys as UaaTokenKeys[]
}

export function cfPasswordGrant(url: string, user: string, password: string) {
  const oa = new ClientOAuth2({ accessTokenUri: `${url}/oauth/token` })
  return oa.owner.getToken(user, password as string, {
    headers: { Authorization: "Basic Y2Y6" }
  })
}

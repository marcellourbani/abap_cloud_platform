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

export const cfInfo = (cfEndPoint: string) => {
  const headers = { Accept: "application/json" }
  return got(cfEndPoint, { headers }).then(resp => {
    const info = JSON.parse(resp.body)
    if (!isCfInfo(info)) throw new Error("Failed to retrieve CloufFoundry info")
    return info
  })
}

export function cfPasswordGrant(url: string, user: string, password: string) {
  const oa = new ClientOAuth2({ accessTokenUri: `${url}/oauth/token` })
  return oa.owner.getToken(user, password as string, {
    headers: { Authorization: "Basic Y2Y6" }
  })
}

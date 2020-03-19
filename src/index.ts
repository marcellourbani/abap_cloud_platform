import ClientOAuth2 from "client-oauth2"
import got from "got"
import express, { Express, RequestHandler, Request } from "express"
import { Server } from "http"
import opn from "open"

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

export interface CfEntity {}
export interface CfMetadata {
  created_at: string
  guid: string
  updated_at: string
  url: string
}
const isCfMetadata = (r: CfMetadata): r is CfMetadata =>
  !!r?.guid && !!r.created_at && !!r.url

export interface CfResource<T extends CfEntity> {
  metadata: CfMetadata
  entity: T
}

const isCfResource = <T extends CfEntity>(
  r: CfResource<T>
): r is CfResource<T> => !!r?.entity && !isCfMetadata(r?.metadata)

export interface CfResult<T extends CfEntity> {
  total_results: number
  total_pages: number
  prev_url?: string | null
  next_url?: string | null
  resources: CfResource<T>[]
}

const isCfResult = <T extends CfEntity>(keyRes: any): keyRes is CfResult<T> =>
  Array.isArray(keyRes?.resources) &&
  (keyRes.total_results || keyRes.total_results === 0)
export interface CfOrganizationEntity extends CfEntity {
  app_events_url: string
  auditors_url: string
  billing_enabled: boolean
  billing_managers_url: string
  default_isolation_segment_guid?: string
  domains_url: string
  managers_url: string
  name: string
  private_domains_url: string
  quota_definition_guid: string
  quota_definition_url: string
  space_quota_definitions_url: string
  spaces_url: string
  status: string
  users_url: string
}
const isCfOrganizationEntity = (x: any): x is CfOrganizationEntity =>
  !!(x?.spaces_url && x?.app_events_url && x?.auditors_url && x?.name)

export interface CfSpaceEntity extends CfEntity {
  allow_ssh: boolean
  app_events_url: string
  apps_url: string
  auditors_url: string
  developers_url: string
  domains_url: string
  events_url: string
  name: string
  isolation_segment_guid?: string
  managers_url: string
  organization_guid: string
  organization_url: string
  routes_url: string
  security_groups_url: string
  service_instances_url: string
  space_quota_definition_guid?: string
  staging_security_groups_url: string
}
const isCfSpaceEntity = (x: any): x is CfSpaceEntity =>
  !!(
    x?.service_instances_url &&
    x?.app_events_url &&
    x?.auditors_url &&
    x?.name
  )
export interface CfServiceEntity extends CfEntity {
  active: boolean
  allow_context_updates: boolean
  bindable: boolean
  bindings_retrievable: boolean
  description: string
  documentation_url?: string
  extra: string
  info_url?: string
  instances_retrievable: boolean
  label: string
  long_description?: string
  plan_updateable: boolean
  provider?: string
  requires: any[]
  service_broker_guid: string
  service_broker_name: string
  service_plans_url: string
  tags: string[]
  unique_id: string
  url?: string
  version?: string
}

const isCfServiceEntity = (x: any): x is CfServiceEntity =>
  !!(x?.unique_id && x?.service_broker_guid && x?.description)

export interface LastOperation {
  created_at: string
  description: string
  state: string
  type: string
  updated_at: string
}

export interface CfServiceInstanceEntity extends CfEntity {
  credentials: any
  dashboard_url: string
  gateway_data?: string
  last_operation: LastOperation
  maintenance_info: any
  routes_url: string
  service_bindings_url: string
  service_guid: string
  service_instance_parameters_url: string
  service_keys_url: string
  service_plan_guid: string
  service_plan_url: string
  service_url: string
  shared_from_url: string
  shared_to_url: string
  space_guid: string
  space_url: string
  tags: any[]
  type: string
}

const isCfServiceInstanceEntity = (x: any): x is CfServiceInstanceEntity =>
  !!(x?.service_guid && x?.service_url && x?.space_guid && x?.name)

interface ServiceKey {}
export interface AbapServiceKey extends ServiceKey {
  uaa: {
    uaadomain: string
    tenantmode: string
    sburl: string
    clientid: string
    verificationkey: string
    apiurl: string
    xsappname: string
    identityzone: string
    identityzoneid: string
    clientsecret: string
    tenantid: string
    url: string
  }
  url: string
  "sap.cloud.service": string
  systemid: string
  endpoints: {
    abap: string
  }
  catalogs: {
    abap: {
      path: string
      type: string
    }
  }
  binding: {
    env: string
    version: string
    type: string
    id: string
  }
}
export const isAbapServiceKey = (x: any): x is AbapServiceKey =>
  !!(x?.catalogs?.abap && x?.uaa?.url && x.uaa?.clientid && x.uaa?.clientsecret)

export interface AbapEntity extends CfEntity {
  service_instance_guid: string
  credentials: AbapServiceKey
  service_instance_url: string
  service_key_parameters_url: string
}
export const isAbapEntity = (x: any): x is AbapEntity =>
  isAbapServiceKey(x?.credentials)

interface LoginServer<T> {
  callbackRequest: Promise<T>
  redirectUri: string
}
interface ExpressLoginServer extends LoginServer<Request> {
  app: Express
  server: Server
}
//////////////////////////////////////////////////////
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

export async function cfOrganizations(cfEndPoint: string, token: string) {
  const headers = {
    Authorization: `bearer ${token}`,
    Accept: "application/json"
  }
  const searchParams = { "order-by": "name", "order-direction": "asc" }
  const resp = await got(`${cfEndPoint}/v2/organizations`, {
    headers,
    searchParams
  })
  const orgRes = JSON.parse(resp.body)
  if (
    !isCfResult(orgRes) ||
    !orgRes.resources.every(r => isCfOrganizationEntity(r.entity))
  )
    throw new Error("Unexpected response format for Organizations")
  return orgRes.resources as CfResource<CfOrganizationEntity>[]
}

export async function cfSpaces(
  cfEndPoint: string,
  organization: CfOrganizationEntity,
  token: string
) {
  const headers = {
    Authorization: `bearer ${token}`,
    Accept: "application/json"
  }
  const searchParams = { "order-by": "name", "order-direction": "asc" }
  const resp = await got(`${cfEndPoint}${organization.spaces_url}`, {
    headers,
    searchParams
  })
  const orgRes = JSON.parse(resp.body)
  if (
    !isCfResult(orgRes) ||
    !orgRes.resources.every(r => isCfSpaceEntity(r.entity))
  )
    throw new Error("Unexpected response format for Spaces")
  return orgRes.resources as CfResource<CfSpaceEntity>[]
}

export async function cfServices(cfEndPoint: string, token: string) {
  const headers = {
    Authorization: `bearer ${token}`,
    Accept: "application/json"
  }
  const searchParams = { "order-direction": "asc", active: true }
  const options = { headers, searchParams }
  const resp = await got(`${cfEndPoint}/v2/services`, options)
  const orgRes = JSON.parse(resp.body)
  if (
    !isCfResult(orgRes) ||
    !orgRes.resources.every(r => isCfServiceEntity(r.entity))
  )
    throw new Error("Unexpected response format for service instance")
  return orgRes.resources as CfResource<CfServiceEntity>[]
}

export async function cfServiceInstances(
  cfEndPoint: string,
  space: CfSpaceEntity,
  token: string
) {
  const headers = {
    Authorization: `bearer ${token}`,
    Accept: "application/json"
  }
  const searchParams = { "order-by": "name", "order-direction": "asc" }
  const resp = await got(`${cfEndPoint}${space.service_instances_url}`, {
    headers,
    searchParams
  })
  const orgRes = JSON.parse(resp.body)
  if (
    !isCfResult(orgRes) ||
    !orgRes.resources.every(r => isCfServiceInstanceEntity(r.entity))
  )
    throw new Error("Unexpected response format for service instance")
  return orgRes.resources as CfResource<CfServiceInstanceEntity>[]
}

export async function cfInstanceServiceKey(
  cfEndPoint: string,
  instance: CfServiceInstanceEntity,
  name: string,
  token: string
) {
  const headers = {
    Authorization: `bearer ${token}`,
    Accept: "application/json"
  }

  const resp = await got(`${cfEndPoint}${instance.service_keys_url}`, {
    headers,
    searchParams: { q: `name:${name}` }
  })
  const keyRes = JSON.parse(resp.body)
  if (!isCfResult(keyRes))
    throw new Error("Unexpected response format for instance servicekey")
  if (keyRes.total_results !== 1 || keyRes.resources.length !== 1)
    throw new Error("Unexpected response format for instance servicekey")
  return keyRes.resources[0]
}

export async function cfInstanceServiceKeyCreate<T extends CfEntity>(
  cfEndPoint: string,
  instance: CfResource<CfServiceInstanceEntity>,
  name: string,
  token: string
) {
  const headers = {
    Authorization: `bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  }
  const body = JSON.stringify({
    name,
    service_instance_guid: instance.metadata.guid
  })
  const method = "POST"
  const o = { headers, body }
  const resp = await got(`${cfEndPoint}/v2/service_keys`, { method, ...o })
  const keyRes = JSON.parse(resp.body)
  if (!isCfResource(keyRes))
    throw new Error("Unexpected response format for instance servicekey")
  return keyRes as CfResource<T>
}

export async function cfInstanceServiceKeyDelete(
  cfEndPoint: string,
  guid: string,
  token: string
) {
  const headers = {
    Authorization: `bearer ${token}`,
    "Content-Type": "application/json"
  }
  const method = "DELETE"
  await got(`${cfEndPoint}/v2/service_keys/${guid}`, {
    method,
    headers
  })
}

export function cfPasswordGrant(url: string, user: string, password: string) {
  const oa = new ClientOAuth2({ accessTokenUri: `${url}/oauth/token` })
  return oa.owner.getToken(user, password as string, {
    headers: { Authorization: "Basic Y2Y6" }
  })
}

export function loginServer(
  port = 0,
  successHandler: RequestHandler = (req, res) =>
    res.send("Login successful, please close this window")
): ExpressLoginServer {
  const loginPath = "/oauth/client/redirect/link"
  const successPath = "/logon/success"
  const app = express()
  const server = app.listen(port)
  const actualPort = (server.address() as any)?.port
  if (!actualPort) throw new Error("Failed to start login server")

  const callbackRequest = new Promise<Request>(async resolve => {
    app.get(loginPath, (req, res) => {
      res.status(302)
      res.setHeader(
        "Location",
        `http://localhost:${port}${successPath}?code=${req.query.code}&action=link`
      )
      res.send()
      resolve(req)
    })
    app.get(successPath, successHandler, () => server.close())
  })

  const redirectUri = `http://localhost:${port}${loginPath}`

  return { app, server, callbackRequest, redirectUri }
}

export async function cfCodeGrant<T extends { url: string }>(
  uaaUrl: string,
  clientId: string,
  clientSecret: string,
  server: LoginServer<T>
) {
  const { redirectUri, callbackRequest } = server
  const oa = new ClientOAuth2({
    authorizationUri: `${uaaUrl}/oauth/authorize`,
    accessTokenUri: `${uaaUrl}/oauth/token`,
    redirectUri,
    clientId,
    clientSecret
  })
  opn(oa.code.getUri())
  const url = (await callbackRequest).url
  return await oa.code.getToken(url)
}

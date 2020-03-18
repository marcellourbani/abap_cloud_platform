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

export interface CfEntity {}
export interface CfMetadata {
  created_at: string
  guid: string
  updated_at: string
  url: string
}
export interface CfResource<T extends CfEntity> {
  metadata: CfMetadata
  entity: T
}
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
export function cfPasswordGrant(url: string, user: string, password: string) {
  const oa = new ClientOAuth2({ accessTokenUri: `${url}/oauth/token` })
  return oa.owner.getToken(user, password as string, {
    headers: { Authorization: "Basic Y2Y6" }
  })
}

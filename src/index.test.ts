import { isAbapServiceKey, isAbapEntity } from "./index"
// all these tests use an actual CF account defined in setenv.js, will not run without valid credentials
import {
  cfPasswordGrant,
  cfInfo,
  cfTokenKeys,
  cfOrganizations,
  cfSpaces,
  cfServices,
  cfServiceInstances,
  cfInstanceServiceKey
} from "."

const getenv = () => {
  const { CFUSER, CFPASSWORD, CFENDPOINT } = process.env
  if (!(CFUSER && CFPASSWORD && CFENDPOINT)) throw "Environment not set"
  return { CFUSER, CFPASSWORD, CFENDPOINT }
}

const getCfAccessToken = async () => {
  const { CFUSER, CFPASSWORD, CFENDPOINT } = getenv()
  const info = await cfInfo(CFENDPOINT)
  const login = info.links?.login?.href

  const token = await cfPasswordGrant(login!, CFUSER, CFPASSWORD)
  return token.accessToken
}
const getServiceInstances = async () => {
  const { CFENDPOINT } = getenv()
  const token = await getCfAccessToken()

  const organizations = await cfOrganizations(CFENDPOINT, token)
  const spaces = await cfSpaces(CFENDPOINT, organizations[0].entity, token)
  const space = spaces[0]
  const instances = await cfServiceInstances(CFENDPOINT, space.entity, token)
  return { instances, token, space }
}

const getAbapInstance = async () => {
  const { CFENDPOINT } = getenv()
  const { instances, token } = await getServiceInstances()
  const services = await cfServices(CFENDPOINT, token)
  const service = services.find(
    s => s.entity.tags && s.entity.tags.find(t => t === "abapcp")
  )
  const instance = instances.find(
    i => i.entity.service_guid === service?.metadata.guid
  )

  return { instance, token }
}
test("cloud foundry endpoint info", async () => {
  const { CFENDPOINT } = getenv()
  const info = await cfInfo(CFENDPOINT)
  expect(info.links?.login?.href).toBeDefined()
})

test("token keys", async () => {
  const { CFENDPOINT } = getenv()
  const info = await cfInfo(CFENDPOINT)
  const login = info.links?.login?.href

  const tokenKeys = await cfTokenKeys(login!)
  expect(tokenKeys.length).toBe(1)
  expect(tokenKeys[0].alg).toBeDefined()
  expect(tokenKeys[0].value).toBeDefined()
})

test("password grant", async () => {
  const { CFUSER, CFPASSWORD, CFENDPOINT } = getenv()
  const info = await cfInfo(CFENDPOINT)
  const login = info.links?.login?.href

  const token = await cfPasswordGrant(login!, CFUSER, CFPASSWORD)
  expect(token.accessToken).toBeDefined()
  expect(token.refreshToken).toBeDefined()
})

test("Organizations", async () => {
  const { CFENDPOINT } = getenv()
  const token = await getCfAccessToken()

  const organizations = await cfOrganizations(CFENDPOINT, token)
  expect(organizations.length).toBeTruthy()
  expect(organizations[0].entity.name).toBeDefined()
})

test("cf Spaces", async () => {
  const { CFENDPOINT } = getenv()
  const token = await getCfAccessToken()

  const organizations = await cfOrganizations(CFENDPOINT, token)
  const spaces = await cfSpaces(CFENDPOINT, organizations[0].entity, token)
  expect(spaces.length).toBeTruthy()
  expect(spaces[0].entity.name).toBeDefined()
})

test("cf services", async () => {
  const { CFENDPOINT } = getenv()
  const token = await getCfAccessToken()

  const services = await cfServices(CFENDPOINT, token)
  const service = services.find(
    s => s.entity.tags && s.entity.tags.find(t => t === "abapcp")
  )
  expect(service).toBeDefined()
})

test("cf instances", async () => {
  const { instances } = await getServiceInstances()
  expect(instances.length).toBeGreaterThan(0)
})

test("cf get service key", async () => {
  const { CFENDPOINT } = getenv()
  const { instance, token } = await getAbapInstance()
  if (!instance?.entity) throw "No entity found"
  const serviceKey = await cfInstanceServiceKey(
    CFENDPOINT,
    instance?.entity,
    "SAP_ADT",
    token
  )

  expect(isAbapEntity(serviceKey.entity)).toBe(true)
})

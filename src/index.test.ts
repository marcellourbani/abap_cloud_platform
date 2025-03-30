import got from "got"
import {
  isAbapServiceKey,
  isAbapEntity,
  cfInstanceServiceKeyCreate,
  cfInstanceServiceKeyDelete,
  cfCodeGrant,
  loginServer,
  getAbapUserInfo,
  getAbapSystemInfo,
  cfInstanceServiceKeys
} from "./index"
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
  const { CFUSER, CFPASSWORD, CFENDPOINT, ORGNAME } = process.env
  if (!(CFUSER && CFPASSWORD && CFENDPOINT)) throw "Environment not set"
  return { CFUSER, CFPASSWORD, CFENDPOINT, ORGNAME }
}

const getCfAccessToken = async () => {
  const { CFUSER, CFPASSWORD, CFENDPOINT } = getenv()
  const info = await cfInfo(CFENDPOINT)
  const login = info.links?.login?.href

  const token = await cfPasswordGrant(login!, CFUSER, CFPASSWORD)
  return token.accessToken
}
const getServiceInstances = async () => {
  const { CFENDPOINT, ORGNAME } = getenv()
  const token = await getCfAccessToken()

  const organizations = await cfOrganizations(CFENDPOINT, token)
  const myorg =
    organizations.find(o => o.entity.name === ORGNAME) || organizations[0]
  const spaces = await cfSpaces(CFENDPOINT, myorg.entity, token)
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

const getServiceKey = async (name: string) => {
  const { CFENDPOINT } = getenv()
  const { instance, token } = await getAbapInstance()
  if (!instance?.entity) throw "No entity found"
  return cfInstanceServiceKey(CFENDPOINT, instance?.entity, name, token)
}

const getServiceKeys = async () => {
  const { CFENDPOINT } = getenv()
  const { instance, token } = await getAbapInstance()
  if (!instance?.entity) throw "No entity found"
  return cfInstanceServiceKeys(CFENDPOINT, instance?.entity, token)
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
  expect(tokenKeys.length).toBeGreaterThan(1)
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
  jest.setTimeout(8000)
  const serviceKey = await getServiceKey("SAP_ADT")
  expect(isAbapEntity(serviceKey.entity)).toBe(true)
})

test("cf get service keys", async () => {
  jest.setTimeout(8000)
  const serviceKeys = await getServiceKeys()
  expect(Array.isArray(serviceKeys)).toBeTruthy()
  expect(isAbapEntity(serviceKeys[0]?.entity)).toBe(true)
})

test("cf create and delete service key", async () => {
  const { CFENDPOINT } = getenv()
  const NAME = "cphelpertest"
  const { instance, token } = await getAbapInstance()
  if (!instance) throw "No entity found"
  let serviceKey
  try {
    serviceKey = await cfInstanceServiceKeyCreate(
      CFENDPOINT,
      instance,
      NAME,
      token
    )
  } catch (error) {
    // creation failed, might be because it exists already
    serviceKey = await cfInstanceServiceKey(
      CFENDPOINT,
      instance.entity,
      NAME,
      token
    )
  }

  await cfInstanceServiceKeyDelete(CFENDPOINT, serviceKey.metadata.guid, token)
})

test("cf code grant and abap server details", async () => {
  const start = new Date().getTime()
  const now = new Date().getTime()
  if (now - start < 10) return //will not run unless there's a breakpoint set here
  jest.setTimeout(60000) // 1 minute. This requires browser interaction
  const key = (await getServiceKey("SAP_ADT"))?.entity
  if (!isAbapEntity(key)) throw "Not a valid abap key"
  const { url, clientid, clientsecret } = key.credentials.uaa

  // code token
  const grant = await cfCodeGrant(url, clientid, clientsecret, loginServer())

  expect(grant.accessToken).toBeDefined()

  const userInfo = await getAbapUserInfo(key.credentials.url, grant.accessToken)
  expect(userInfo.UNAME).toBeDefined()

  const info = await getAbapSystemInfo(key.credentials.url, grant.accessToken)
  expect(info.SYSID).toMatch(/[A-Z]\w\w/)
  const headers = {
    Authorization: `bearer ${grant.accessToken}`,
    Accept: "text/plain"
  }
  const resp = await got(
    `${key.credentials.url}/sap/bc/adt/oo/classes/cx_root/source/main`,
    { headers }
  )

  expect(resp.body.match(/class\s+cx_root\s+definition/i)).toBeDefined()
})

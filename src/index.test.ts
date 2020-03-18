// all these tests use an actual CF account defined in setenv.js, will not run without valid credentials
import {
  cfPasswordGrant,
  cfInfo,
  cfTokenKeys,
  cfOrganizations,
  cfSpaces
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

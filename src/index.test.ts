// all these tests use an actual CF account defined in setenv.js, will not run without valid credentials
import { cfPasswordGrant, cfInfo } from "."

const getenv = () => {
  const { CFUSER, CFPASSWORD, CFENDPOINT } = process.env
  if (!(CFUSER && CFPASSWORD && CFENDPOINT)) throw "Environment not set"
  return { CFUSER, CFPASSWORD, CFENDPOINT }
}

test("cloud foundry endpoint info", async () => {
  const { CFENDPOINT } = getenv()
  const info = await cfInfo(CFENDPOINT)
  expect(info.links?.login?.href).toBeDefined()
})

test("password grant", async () => {
  const { CFUSER, CFPASSWORD, CFENDPOINT } = getenv()
  const info = await cfInfo(CFENDPOINT)
  const login = info.links?.login?.href

  const token = await cfPasswordGrant(login!, CFUSER, CFPASSWORD)
  expect(token.accessToken).toBeDefined()
  expect(token.refreshToken).toBeDefined()
})

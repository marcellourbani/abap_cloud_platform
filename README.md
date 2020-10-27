# Abap cloud platform

The minimum cloud foundry/SAP cloud platform APIs required to access an APAP repository. Might be useful for other cloud foundry services

## Usage example

Get the authentication token

```typescript
const CFENDPOINT = "https://api.cf.eu10.hana.ondemand.com" // EU cloud trial
// get the login URL
const info = await cfInfo(CFENDPOINT)
const loginUrl = info.links.login.href
// get logon token
const pwdGrant = await cfPasswordGrant(loginUrl, "username", "password")
const token = pwdGrant.accessToken
```

Use it to get the cf account organizations/spaces/instances/...

```typescript
// cf Organizations
const organizations = await cfOrganizations(CFENDPOINT, token)
//cf spaces
const spaces = await cfSpaces(CFENDPOINT, organizations[0].entity, token)
// cf Service instances
const instances = await cfServiceInstances(CFENDPOINT, spaces[0].entity, token)
// cf Services
const services = await cfServices(CFENDPOINT, token)
```

...nad then get the ABAP service key

```typescript
// now I want the ABAP service key, so let's find the right service instance
const findAbapTag = (tags: string[]) => tags && tags.find(t => t === "abapcp")
const abapService = services.find(s => findAbapTag(s.entity.tags))
const abapServiceInstance = instances.find(
  i => i.entity.service_guid === abapService?.metadata.guid
)
// list of all keys
const abapServiceKeys = await cfInstanceServiceKeys(
  CFENDPOINT,
  abapServiceInstance.entity,
  token
)
// a single key named SAP_ADT, usually used by Exlipse
const abapServiceKey = await cfInstanceServiceKey(
  CFENDPOINT,
  abapServiceInstance.entity,
  "SAP_ADT",
  token
)
```

Finally ask the user to login (on his browser) and get some ABAP code

```typescript
const { url, clientid, clientsecret } = abapServiceKey.entity.credentials.uaa

// code token This will open a browser window where the user can login.
// Beware: no timeout
const codeGrant = await cfCodeGrant(url, clientid, clientsecret, loginServer())

const headers = {
  Authorization: `bearer ${codeGrant.accessToken}`,
  Accept: "text/plain"
}
const resp = await got(
  `${key.credentials.url}/sap/bc/adt/oo/classes/cx_root/source/main`,
  { headers }
)
```

Get system details based on the given token

```typescript
const user = await getAbapUserInfo(key.credentials.url, codeGrant.accessToken)
console.log(user.UNAME)

const info = await getAbapSystemInfo(key.credentials.url, codeGrant.accessToken)
console.log(info.SYSID)
```

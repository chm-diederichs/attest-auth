# attest-auth

Verify a keypair using a challenge

```js
npm install attest-auth
```

## Usage

```js
const Authenticator = require('attest-auth')
const curve = require('noise-handshake/dh')

const keypair = curve.generateKeyPair()
const serverKeys = curve.generateKeyPair()

const server = new Authenticator(serverKeys, { curve })

let serverLogin = server.createServerLogin({
  timeout: 2 * 60 * 1000,
  description: 'Bitfinex'
})

serverLogin.on('verify', function () {
  console.log(serverLogin.publicKey.slice(0, 4).toString('hex'), 'logged in!')
})

// User passes challenge somehow to auth device
const metadata = Buffer.from('put metadata here.')
const trustedLogin = Authenticator.createClientLogin(keypair, serverKeys.pub, serverLogin.challenge, { curve, metadata })

trustedLogin.on('verify', function (info) {
  console.log(info.publicKey.slice(0, 8), 'logged in!', info)
  console.log(Buffer.from(info.metadata, 'base64').toString()) // put metadata here.
})

// Verify the challenge using our local key pair
serverLogin = server.verify(trustedLogin.request, { metadata })

console.log(serverLogin.clientMetadata.toString()) // put metadata here.

// Pass the server response back so the trustedLogin knows it worked as well
trustedLogin.verify(serverLogin.response)
```

## API

#### `const auth = new Authenticator(severKeyPair, [options])`

Make a new authenticator.

#### `serverLogin = auth.createServerLogin([options])`

Make a server login instance.

`options` object takes the following parameters:
```js
{
  curve  // specify curve to be used for dh, must be noise-handshake compliant
}
```

#### `serverLogin.challenge`

Pass this challenge to the client to login

#### `serverLogin.on('verify', () => ...)`

Emitted when the client has proved the challenge using a key pair

#### `serverLogin.on('error', () => ...)`

Emitted when the login fails or times out.

#### `serverLogin.publicKey`

Populated after the client has verified the login.

#### `trustedLogin = Authenticator.createClientLogin(clientKeyPair, serverPublicKey, challenge, [options])`

Created a client login pointing to the server and the challenge.

`options` object takes the following parameters:
```js
{
  curve,    // specify curve to be used for dh, must be noise-handshake compliant
  metadata  // optional metadata to be passed as a buffer
}
```

#### `trustedLogin.request`

Send this request to the server to login.

#### `serverLogin = auth.verify(loginRequest, [options])`

Verified a login from the client. Returns the matched login instance, or throws otherwise.

If verified the serverLogin instance emits `verify` at this stage.

`options` object takes the following parameters:
```js
{
  metadata  // optional metadata to be passed as a buffer
}
```

#### `serverLogin.response`

Contains the response buffer after a succesful login, send this back to the client.

`response` object has the form
```js
{
  type,
  publicKey,   // hex encoded public key
  description,
  metadata     // base64 encoded metadata
}
```

#### `trustedLogin.verify(loginResponse)`

Verify that the server logged the user in, throws otherwise.

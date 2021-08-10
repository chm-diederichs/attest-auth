const Authenticator = require('./')
const curve = require('noise-handshake/dh')
const test = require('tape')

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

// user passes challenge somehow to auth device

const trustedLogin = Authenticator.createClientLogin(
  keypair,
  serverKeys.publicKey,
  serverLogin.challenge,
  {
    curve,
    metadata: Buffer.from('abcdef', 'hex')
  }
)

serverLogin = server.verify(trustedLogin.request, {
  metadata: Buffer.from('123456', 'hex')
})
trustedLogin.verify(serverLogin.response)

console.log('server client', serverLogin.clientMetadata)
console.log('server server', serverLogin.serverMetadata)
console.log('client client', trustedLogin.metadata)

test('ClientLogin.verify() with invalid parameters', function (t) {
  t.ok(trustedLogin.verify(null))
  t.equal(
    trustedLogin.verify(null).err.message,
    'this.handshake.shift is not a function or its return value is not iterable'
  )
})

test('ClientLogin.verify() with valid ServerLogin response', function (t) {
  t.deepEqual(trustedLogin.verify(serverLogin.response), {
    type: 'login',
    publicKey: keypair.publicKey.toString('hex'),
    description: 'Bitfinex',
    metadata: 'EjRW'
  })
})

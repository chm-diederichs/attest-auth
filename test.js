const Authenticator = require('./')
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

// user passes challenge somehow to auth device

const auth = Authenticator.parseChallenge(serverLogin.getChallenge())
const trustedLogin = Authenticator.createClientLogin(
  keypair,
  serverKeys.pub,
  auth.challenge,
  {
    curve,
    metadata: Buffer.from('abcdef', 'hex')
  }
)

trustedLogin.on('verify', function (info) {
  console.log(info.publicKey.slice(0, 8), 'logged in!')

  const failedLogin = Authenticator.createClientLogin(keypair, serverKeys.pub, auth.challenge, { curve })
  serverLogin = server.verify(failedLogin.request) // throw error
})

serverLogin = server.verify(trustedLogin.request, {
  metadata: Buffer.from('123456', 'hex')
})
trustedLogin.verify(serverLogin.response)

console.log('server client', serverLogin.clientMetadata)
console.log('server server', serverLogin.serverMetadata)
console.log('client client', trustedLogin.metadata)

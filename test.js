const Authenticator = require('./')
const curve = require('noise-handshake/dh')
const sodium = require('sodium-native')

const keypair = curve.generateKeypair()
const serverKeys = curve.generateKeypair()

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
  serverKeys.pub,
  serverLogin.challenge,
  { curve: secp }
)

trustedLogin.on('verify', function (info) {
  console.log(info.publicKey.slice(0, 8), 'logged in!')

  const failedLogin = Authenticator.createClientLogin(keypair, serverKeys.pub, serverLogin.challenge, { curve: secp })
  serverLogin = server.verify(failedLogin.request) // throw error
})

serverLogin = server.verify(trustedLogin.request)
trustedLogin.verify(serverLogin.response)

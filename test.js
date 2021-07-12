const Authenticator = require('./')
const sodium = require('sodium-native')

const keypair = {
  pub: Buffer.alloc(32),
  priv: Buffer.alloc(32)
}

const serverKeys = {
  pub: Buffer.alloc(32),
  priv: Buffer.alloc(32)
}

sodium.crypto_kx_keypair(keypair.pub, keypair.priv)
sodium.crypto_kx_keypair(serverKeys.pub, serverKeys.priv)

const server = new Authenticator(serverKeys)

let serverLogin = server.createServerLogin({
  timeout: 2 * 60 * 1000,
  description: 'Bitfinex'
})

serverLogin.on('verify', function () {
  console.log(serverLogin.publicKey.slice(0, 4).toString('hex'), 'logged in!')
})

// user passes challenge somehow to auth device

const trustedLogin = Authenticator.createClientLogin(keypair, serverKeys.pub, serverLogin.challenge)
trustedLogin.on('verify', function (info) {
  console.log(info.publicKey.slice(0, 8), 'logged in!')

  const failedLogin = Authenticator.createClientLogin(keypair, serverKeys.pub, serverLogin.challenge)
  serverLogin = server.verify(failedLogin.request) // throw error
})

serverLogin = server.verify(trustedLogin.request)
trustedLogin.verify(serverLogin.response)

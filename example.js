const Authenticator = require('./')
const secp = require('noise-handshake/dh')

const keypair = secp.generateKeyPair()
const serverKeys = secp.generateKeyPair()

const server = new Authenticator(serverKeys, { curve: secp })

let serverLogin = server.createServerLogin({
  timeout: 2 * 60 * 1000,
  description: 'Bitfinex'
})

serverLogin.on('verify', function () {
  console.log(serverLogin.publicKey.slice(0, 4).toString('hex'), 'logged in!')
})

// User passes challenge somehow to auth device
const trustedLogin = Authenticator.createClientLogin(keypair, serverKeys.publicKey, serverLogin.challenge, { curve: secp })

trustedLogin.on('verify', function (info) {
  console.log(info.publicKey.slice(0, 8), 'logged in!', info)
})

// Verify the challenge using our local key pair
serverLogin = server.verify(trustedLogin.request)

// Pass the server response back so the trustedLogin knows it worked as well
trustedLogin.verify(serverLogin.response)

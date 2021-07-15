const Noise = require('noise-handshake')
const sodium = require('sodium-native')
const { EventEmitter} = require('events')

const PROLOGUE = Buffer.alloc(0)

module.exports = class {
  constructor (keypair, opts = {}) {
    this.sessions = new Map()
    this.keypair = keypair
    this.opts = opts
  }

  createServerLogin ({ timeout, description }) {
    const challenge = Buffer.allocUnsafe(32)
    sodium.randombytes_buf(challenge)

    const session = new ServerLogin({
      challenge,
      description,
      timeout
    })

    this.sessions.set(challenge.toString('hex'), session)

    setTimeout(this._gc.bind(this), timeout, session)

    return session
  }

  verify (request) {
    const handshake = new Noise('IK', false, this.keypair, this.opts)

    handshake.initialise(PROLOGUE)
    const challenge = handshake.recv(request)

    const identifier = challenge.toString('hex')
    const session = this.sessions.get(identifier)

    if (session == null) {
      throw new Error('Login info not recognised')
    }

    this.sessions.delete(identifier)

    session.respond(handshake.rs, handshake)
    return session
  }

  static createClientLogin (keypair, serverPk, challenge, opts = {}) {
    const handshake = new Noise('IK', true, keypair, opts)

    handshake.initialise(PROLOGUE, serverPk)

    return new ClientLogin({
      handshake,
      challenge,
      remotePublicKey: serverPk,
    })
  }

  _gc (login) {
    this.sessions.delete(login.challenge.toString('hex'))
  }
}

class ClientLogin extends EventEmitter {
  constructor ({ challenge, handshake, remotePublicKey }) {
    super()

    this.challenge = challenge
    this.handshake = handshake
    this.remotePublicKey = remotePublicKey

    this.request = this.handshake.send(challenge)
  }

  verify (response) {
    try {
      const msg = JSON.parse(this.handshake.recv(response))
      this.emit('verify', msg)
    } catch (err) {
      this.emit('error', err)
    }
  }
}

class ServerLogin extends EventEmitter {
  constructor ({ challenge, description }) {
    super()

    this.challenge = challenge
    this.description = description

    this.response = null
    this.publicKey = null
  }

  respond (pk, handshake) {
    this.publicKey = pk

    const response = Buffer.from(JSON.stringify({
      type: "login",
      publicKey: pk.toString('hex'),
      description: this.description
    }))

    this.response = handshake.send(response)
    this.emit('verify', pk)
  }
}

const Noise = require('noise-handshake')
const sodium = require('sodium-native')
const { EventEmitter } = require('events')

const PROLOGUE = Buffer.alloc(0)
const CHALLENGE_LENGTH = 32

module.exports = class {
  constructor (keypair, opts = {}) {
    this.sessions = new Map()
    this.keypair = keypair
    this.challengeLength = opts.challengeLength || CHALLENGE_LENGTH
    this.opts = opts
  }

  createServerLogin ({ timeout, description }) {
    const challenge = Buffer.allocUnsafe(this.challengeLength)
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

  verify (request, opts = {}) {
    const handshake = new Noise('IK', false, this.keypair, this.opts)

    handshake.initialise(PROLOGUE)
    const req = handshake.recv(request)

    const challenge = req.subarray(0, this.challengeLength)
    const metadata = req.subarray(this.challengeLength)

    const identifier = challenge.toString('hex')
    const session = this.sessions.get(identifier)

    if (session == null) {
      throw new Error('Login info not recognised')
    }

    this.sessions.delete(identifier)

    if (metadata.byteLength) session.clientMetadata = metadata
    if (opts.metadata) session.serverMetadata = opts.metadata

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
      metadata: opts.metadata
    })
  }

  _gc (login) {
    this.sessions.delete(login.challenge.toString('hex'))
  }
}

class ClientLogin extends EventEmitter {
  constructor ({ challenge, handshake, remotePublicKey, metadata }) {
    super()

    this.challenge = challenge
    this.handshake = handshake
    this.remotePublicKey = remotePublicKey

    this.metadata = metadata || Buffer.alloc(0)

    const payload = [challenge]
    if (metadata) payload.push(metadata)

    this.request = this.handshake.send(Buffer.concat(payload))
    this.response = null
  }

  verify (response) {
    try {
      this.response = JSON.parse(this.handshake.recv(response))
      this.emit('verify', this.response)
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

    this.clientMetadata = null
    this.serverMetadata = null
  }

  respond (pk, handshake, metadata) {
    this.publicKey = pk

    const msg = {
      type: 'login',
      publicKey: pk.toString('hex'),
      description: this.description
    }

    const meta = metadata || this.serverMetadata
    if (meta) msg.metadata = meta.toString('base64')

    const response = Buffer.from(JSON.stringify(msg))

    this.response = handshake.send(response)
    this.emit('verify', pk)
  }
}

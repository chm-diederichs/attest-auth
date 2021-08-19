const Noise = require('noise-handshake')
const sodium = require('sodium-universal')
const c = require('compact-encoding')
const { compile } = require('compact-encoding-struct')
const { EventEmitter } = require('events')

const PROLOGUE = Buffer.alloc(0)
const CHALLENGE_LENGTH = 32

const serverChallenge = compile({
  curve: c.string,
  challenge: c.fixed32
})

module.exports = class AttestAuth {
  constructor (keypair, opts = {}) {
    this.sessions = new Map()
    this.keypair = keypair
    this.challengeLength = opts.challengeLength || CHALLENGE_LENGTH
    this.opts = opts
  }

  createServerLogin ({ timeout, description }) {
    const challenge = Buffer.allocUnsafe(this.challengeLength)
    sodium.randombytes_buf(challenge)

    const curveTag = this.opts.curve.name || 'ed25519'

    const session = new ServerLogin({
      challenge,
      curveTag,
      description
    })

    this.sessions.set(challenge.toString('hex'), session)

    const timer = setTimeout(this._gc.bind(this), timeout, session)
    session.on('verify', clearTimeout, timer)

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
    const auth = c.decode(serverChallenge, challenge)

    let curve
    if (Array.isArray(opts.curve)) {
      curve = opts.curve.find(c => c.name === auth.curve)
    } else {
      curve = opts.curve.name === auth.curve ? opts.curve : null
    }

    if (!curve && auth.curve !== 'Ed25519') {
      throw new Error('No suitable curve provided for:', auth.curve)
    }

    const handshake = new Noise('IK', true, keypair, { curve })
    handshake.initialise(PROLOGUE, serverPk)

    return new ClientLogin({
      handshake,
      challenge: auth.challenge,
      remotePublicKey: serverPk,
      metadata: opts.metadata
    })
  }

  _gc (login) {
    const id = login.challenge.toString('hex')
    if (!this.sessions.has(id)) return
    this.sessions.get(id)._destroy(new Error('Login timeout.'))
    this.sessions.delete(id)
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
    } catch (err) {
      this.emit('error', err)
      return
    }
    this.emit('verify', this.response)
  }
}

class ServerLogin extends EventEmitter {
  constructor ({ challenge, curveTag, description }) {
    super()

    this.curveTag = curveTag
    this.challenge = challenge
    this.description = description

    this.response = null
    this.publicKey = null

    this.clientMetadata = null
    this.serverMetadata = null

    this.destroyed = false
  }

  getChallenge () {
    return c.encode(serverChallenge, {
      curve: this.curveTag,
      challenge: this.challenge
    })
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

  _destroy (err) {
    this.destroyed = true
    this.emit('error', err)
  }
}

const Noise = require('noise-handshake')
const sodium = require('sodium-native')
const { EventEmitter} = require('events')

const PROLOGUE = Buffer.alloc(0)

module.exports = class {
  constructor (keypair) {
    this.sessions = new Map()
    this.keypair = keypair
  }

  createServerLogin ({ timeout, description }) {
    const challenge = Buffer.allocUnsafe(32)
    sodium.randombytes_buf(challenge)

    const session = new Login({ challenge, description, timeout })
    this.sessions.set(challenge.toString('hex'), session)

    setTimeout(this._gc, timeout, session)

    return session
  }

  verify (request) {
    const handshake = new Noise('IK', false, this.keypair)
    handshake.initialise(PROLOGUE)

    const challenge = handshake.recv(request)
    const session = this.sessions.get(challenge.toString('hex'))

    if (session == null) {
      throw new Error("Login info not recognised.")
    }

    this.sessions.delete(challenge.toString('hex'))

    const pk = handshake.rs
    const response = JSON.stringify({
      type: "login",
      publicKey: pk.toString('hex')
    })

    session.publicKey = pk
    session.response = handshake.send(Buffer.from(response))
  
    session.emit('verify', pk)
    return session
  }

  static createClientLogin (keypair, serverPk, challenge) {
    const handshake = new Noise('IK', true, keypair)

    handshake.initialise(PROLOGUE, serverPk)

    const login = new Login({
      handshake,
      challenge,
      remotePublicKey: serverPk,
    })

    login.request = handshake.send(challenge)
    return login
  }

  _gc (login) {
    this.sessions.delete(login.challenge.toString('hex'))
  }
}

class Login extends EventEmitter {
  constructor ({ challenge, description, handshake }) {
    super()

    this.description = description
    this.challenge = challenge
    this.handshake = handshake

    this.response = null
    this.request = null
    this.publicKey = null
  }

  verify (response) {
    try {
      const msg = JSON.parse(this.handshake.recv(response))
      this.emit('verify', this.publicKey)
    } catch (err) {
      console.log(err)
      return response
    }
  }
}

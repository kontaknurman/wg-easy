'use strict';

const { Store } = require('express-session');

// In-memory session store with an idle timeout. express-session's default
// MemoryStore never expires entries whose cookie has no maxAge, so on a
// long-running server every stale login stayed in memory forever.
module.exports = class SessionStore extends Store {

  constructor({ ttlMs, pruneIntervalMs = 10 * 60 * 1000 }) {
    super();
    this.ttlMs = ttlMs;
    this.sessions = new Map();
    setInterval(() => this.prune(), pruneIntervalMs).unref();
  }

  prune() {
    const now = Date.now();
    for (const [sid, entry] of this.sessions) {
      if (entry.expiresAt <= now) this.sessions.delete(sid);
    }
  }

  get(sid, cb) {
    const entry = this.sessions.get(sid);
    if (!entry) return cb(null, null);
    if (entry.expiresAt <= Date.now()) {
      this.sessions.delete(sid);
      return cb(null, null);
    }
    let sess;
    try {
      sess = JSON.parse(entry.data);
    } catch (err) {
      return cb(err);
    }
    return cb(null, sess);
  }

  set(sid, sess, cb) {
    this.sessions.set(sid, {
      data: JSON.stringify(sess),
      expiresAt: Date.now() + this.ttlMs,
    });
    if (cb) cb(null);
  }

  touch(sid, sess, cb) {
    const entry = this.sessions.get(sid);
    if (entry) entry.expiresAt = Date.now() + this.ttlMs;
    if (cb) cb(null);
  }

  destroy(sid, cb) {
    this.sessions.delete(sid);
    if (cb) cb(null);
  }

  length(cb) {
    cb(null, this.sessions.size);
  }

  clear(cb) {
    this.sessions.clear();
    if (cb) cb(null);
  }

};

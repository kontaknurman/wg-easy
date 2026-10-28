'use strict';

const childProcess = require('child_process');

module.exports = class Util {

  static isValidIPv4(str) {
    if (typeof str !== 'string') return false;
    const blocks = str.split('.');
    if (blocks.length !== 4) return false;

    for (const block of blocks) {
      // Digits only: parseInt alone accepts trailing garbage ("5; rm -rf").
      // No leading zeros either: wg rejects "010", and "10.8.0.010" would
      // slip past the duplicate check for "10.8.0.10".
      if (!/^(0|[1-9]\d{0,2})$/.test(block)) return false;
      const value = parseInt(block, 10);
      if (value < 0 || value > 255) return false;
    }

    return true;
  }

  static promisify(fn) {
    // eslint-disable-next-line func-names
    return function(req, res) {
      Promise.resolve().then(async () => fn(req, res))
        .then(result => {
          if (res.headersSent) return;

          if (typeof result === 'undefined') {
            return res
              .status(204)
              .end();
          }

          return res
            .status(200)
            .json(result);
        })
        .catch(error => {
          if (typeof error === 'string') {
            error = new Error(error);
          }

          const statusCode = error.statusCode || 500;
          if (statusCode >= 500) {
            // eslint-disable-next-line no-console
            console.error(error);
          } else {
            // eslint-disable-next-line no-console
            console.error(`${req.method} ${req.path}: ${statusCode} ${error.message}`);
          }

          if (res.headersSent) return;
          // Stack traces stay in the server log; clients only get the message.
          return res
            .status(statusCode)
            .json({
              error: error.message || error.toString(),
            });
        });
    };
  }

  static async exec(cmd, {
    log = true,
  } = {}) {
    if (typeof log === 'string') {
      // eslint-disable-next-line no-console
      console.log(`$ ${log}`);
    } else if (log === true) {
      // eslint-disable-next-line no-console
      console.log(`$ ${cmd}`);
    }

    if (process.platform !== 'linux') {
      return '';
    }

    return new Promise((resolve, reject) => {
      childProcess.exec(cmd, {
        shell: 'bash',
      }, (err, stdout) => {
        if (err) return reject(err);
        return resolve(String(stdout).trim());
      });
    });
  }

  // Run a binary directly (no shell): one process instead of bash + child,
  // and arguments can never be re-interpreted by a shell. `input` is written
  // to stdin (used for `iptables-restore`, `wg syncconf /dev/stdin`).
  static async execFile(file, args = [], {
    log = true,
    input,
    timeout = 30000,
  } = {}) {
    if (typeof log === 'string') {
      // eslint-disable-next-line no-console
      console.log(`$ ${log}`);
    } else if (log === true) {
      // eslint-disable-next-line no-console
      console.log(`$ ${[file, ...args].join(' ')}`);
    }

    if (process.platform !== 'linux') {
      return '';
    }

    return new Promise((resolve, reject) => {
      const child = childProcess.execFile(file, args, {
        timeout,
        maxBuffer: 16 * 1024 * 1024,
      }, (err, stdout) => {
        // err.message already carries the command line and its stderr.
        if (err) return reject(err);
        return resolve(String(stdout).trim());
      });
      if (input !== undefined) {
        child.stdin.on('error', () => { /* reported through the exit callback */ });
        child.stdin.end(input);
      }
    });
  }

};

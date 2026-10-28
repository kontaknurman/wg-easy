'use strict';

require('./services/Server');

const WireGuard = require('./services/WireGuard');

WireGuard.getConfig()
  .catch(err => {
  // eslint-disable-next-line no-console
    console.error(err);

    // eslint-disable-next-line no-process-exit
    process.exit(1);
  });

// `docker stop` sends SIGTERM: write out buffered log lines and stop the
// capture children instead of dying mid-batch.
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down.`);
  // eslint-disable-next-line no-process-exit
  setTimeout(() => process.exit(0), 3000).unref();
  WireGuard.shutdown()
    // eslint-disable-next-line no-process-exit
    .finally(() => process.exit(0));
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

import { startStandaloneServer } from '@apollo/server/standalone';
import { createApplication } from './composition-root.js';

const application = createApplication();
const { apolloServer, config, logger } = application;

let shuttingDown = false;

async function start(): Promise<void> {
  const { url } = await startStandaloneServer(apolloServer, {
    listen: { port: config.port },
  });

  logger.info({ url }, 'Weather activity GraphQL server started');
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, 'Shutting down server');
  await application.shutdown();
}

process.on('SIGINT', (signal) => {
  void shutdown(signal);
});

process.on('SIGTERM', (signal) => {
  void shutdown(signal);
});

start().catch(async (error: unknown) => {
  logger.error({ error }, 'Failed to start server');
  await application.shutdown();
  process.exitCode = 1;
});

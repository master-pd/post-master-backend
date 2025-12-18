import 'dotenv/config';
import cluster from 'cluster';
import os from 'os';

const IS_RENDER = !!process.env.RENDER;
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * ❌ Disable cluster on Render
 */
if (cluster.isPrimary && IS_PROD && !IS_RENDER) {
  console.log(`🚀 Post-Master Pro Backend`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`👷 Master ${process.pid} is running`);

  const numCPUs = Math.min(os.cpus().length, 4);
  console.log(`🔄 Forking ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`❌ Worker ${worker.process.pid} died`);
    console.log(`🔄 Restarting worker...`);
    cluster.fork();
  });

} else {
  /**
   * ✅ Single process (Render compatible)
   */
  import('./core/bootstrap.js')
    .then(async ({ bootstrap }) => {
      try {
        const app = await bootstrap();

        const PORT = process.env.PORT || 10000;

        const server = app.listen(PORT, () => {
          console.log(`✅ Server running on port ${PORT}`);
          console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
          console.log(`🧠 PID: ${process.pid}`);
        });

        const shutdown = () => {
          console.log(`🛑 Shutting down...`);
          server.close(() => process.exit(0));
          setTimeout(() => process.exit(1), 10000);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        app.get('/health', (req, res) => {
          res.json({
            status: 'ok',
            pid: process.pid,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
          });
        });

      } catch (err) {
        console.error('❌ Bootstrap failed:', err);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('❌ Import failed:', err);
      process.exit(1);
    });
}

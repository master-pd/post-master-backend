import 'dotenv/config';
import cluster from 'cluster';
import os from 'os';

// Cluster mode for production
if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
  console.log(`🚀 Post-Master Pro Backend`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`👷 Master ${process.pid} is running`);
  
  const numCPUs = Math.min(os.cpus().length, 4);
  console.log(`🔄 Forking ${numCPUs} workers...`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    console.log(`❌ Worker ${worker.process.pid} died`);
    console.log(`🔄 Restarting worker...`);
    cluster.fork();
  });
  
} else {
  // Worker process
  import('./core/bootstrap.js').then(async ({ bootstrap }) => {
    try {
      const app = await bootstrap();
      
      const PORT = process.env.PORT || 10000;
      const server = app.listen(PORT, () => {
        console.log(`
  ✅ Worker ${process.pid} started
  ✅ Server: http://localhost:${PORT}
  ✅ API: /api/${process.env.API_VERSION || 'v1'}
  ✅ Time: ${new Date().toISOString()}
        `);
      });
      
      // Graceful shutdown
      const shutdown = () => {
        console.log(`🛑 Worker ${process.pid} shutting down...`);
        server.close(() => {
          console.log(`✅ Worker ${process.pid} shutdown complete`);
          process.exit(0);
        });
        
        setTimeout(() => {
          console.error(`❌ Worker ${process.pid} force shutdown`);
          process.exit(1);
        }, 10000);
      };
      
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
      
      // Health endpoint
      app.get('/health', (req, res) => {
        res.json({
          status: 'healthy',
          pid: process.pid,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        });
      });
      
    } catch (error) {
      console.error('❌ Bootstrap failed:', error);
      process.exit(1);
    }
  }).catch(error => {
    console.error('❌ Failed to load bootstrap:', error);
    process.exit(1);
  });
}
import { Router } from 'express';
import { createLogger } from '../shared/logger.js';

const logger = createLogger('router');

class FeatureRouter {
  constructor() {
    this.router = Router();
    this.routes = [];
  }

  register(featureName, routeConfigs) {
    for (const config of routeConfigs) {
      const { method, path, handler, secured = false } = config;
      
      // Add authentication middleware if secured
      const middlewares = [];
      if (secured) {
        middlewares.push(this.authenticate);
      }
      
      // Register route
      this.router[method.toLowerCase()](path, ...middlewares, handler);
      
      this.routes.push({
        feature: featureName,
        method,
        path,
        secured
      });
      
      logger.debug(`Route registered: ${method} ${path} (${featureName})`);
    }
  }

  authenticate(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      // Verify JWT
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  getRouter() {
    return this.router;
  }

  getRoutesForSDK() {
    return this.routes.map(route => ({
      method: route.method,
      path: route.path,
      secured: route.secured,
      feature: route.feature
    }));
  }
}

export default new FeatureRouter();
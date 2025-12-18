import { createLogger } from '../shared/logger.js';

const logger = createLogger('eventBus');

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  initialize() {
    logger.info('Event bus initialized');
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
    logger.debug(`Listener added for event: ${event}`);
  }

  async emit(event, data) {
    const listeners = this.listeners.get(event) || [];
    logger.debug(`Emitting event: ${event} to ${listeners.length} listeners`);
    
    for (const handler of listeners) {
      try {
        await handler(data);
      } catch (error) {
        logger.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  off(event, handler) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(handler);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
}

export default new EventBus();
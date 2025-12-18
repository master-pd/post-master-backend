import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../shared/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('pluginLoader');

export async function loadFeatures(core) {
  logger.info('🔌 Loading feature plugins...');
  
  const featuresPath = path.join(__dirname, '../features');
  
  // Create features directory if not exists
  if (!fs.existsSync(featuresPath)) {
    logger.warn('Features directory not found, creating...');
    fs.mkdirSync(featuresPath, { recursive: true });
    return;
  }
  
  const featureFolders = fs.readdirSync(featuresPath);
  
  for (const folder of featureFolders) {
    const featurePath = path.join(featuresPath, folder);
    const stat = fs.statSync(featurePath);
    
    if (!stat.isDirectory()) continue;
    
    const indexFile = path.join(featurePath, 'index.js');
    
    if (fs.existsSync(indexFile)) {
      await loadFeature(indexFile, folder, core);
    }
  }
  
  logger.info(`✅ ${featureFolders.length} plugins loaded`);
}

async function loadFeature(indexFile, folder, core) {
  try {
    // Dynamic import
    const featureModule = await import(`file://${indexFile}`);
    
    if (featureModule.register && typeof featureModule.register === 'function') {
      await featureModule.register(core);
      logger.info(`✅ [PLUGIN LOADED] ${folder}`);
    } else {
      logger.warn(`❌ [PLUGIN SKIPPED] ${folder} - No register function`);
    }
  } catch (error) {
    logger.error(`❌ [PLUGIN FAILED] ${folder}:`, error);
  }
}

export default { loadFeatures };
"use strict";
/**
 * model_registry.ts
 * Manages model versioning, deployment, and lifecycle
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRegistry = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ModelRegistry {
    constructor() {
        // Set up paths
        this.registryPath = path.resolve(__dirname, '../../../../../training/model_registry.json');
        this.deploymentPath = path.resolve(__dirname, '../../../../../training/deployment');
        this.trainingPath = path.resolve(__dirname, '../../../../../training');
        // Ensure registry file exists
        if (!fs.existsSync(this.registryPath)) {
            fs.writeFileSync(this.registryPath, JSON.stringify([], null, 2));
        }
    }
    /**
     * Registers a new model in the registry
     */
    async registerModel(modelInfo) {
        const registry = this.getRegistry();
        // Check if model already exists
        if (registry.find(m => m.modelId === modelInfo.modelId)) {
            throw new Error(`Model with ID ${modelInfo.modelId} already exists in registry`);
        }
        const modelMetadata = {
            ...modelInfo,
            status: 'staging',
            createdAt: new Date().toISOString()
        };
        registry.push(modelMetadata);
        this.saveRegistry(registry);
        console.log(`Model ${modelInfo.modelId} (${modelInfo.version}) registered successfully`);
        return modelMetadata;
    }
    /**
     * Promotes a model to production status
     */
    async promoteModelToProduction(modelId) {
        const registry = this.getRegistry();
        const modelIndex = registry.findIndex(m => m.modelId === modelId);
        if (modelIndex === -1) {
            throw new Error(`Model with ID ${modelId} not found in registry`);
        }
        // Find current production model of same type and archive it
        const currentProductionModel = registry.find(m => m.modelType === registry[modelIndex].modelType && m.status === 'production');
        if (currentProductionModel) {
            const currentIndex = registry.findIndex(m => m.modelId === currentProductionModel.modelId);
            registry[currentIndex] = {
                ...currentProductionModel,
                status: 'archived',
                archivedAt: new Date().toISOString()
            };
        }
        // Deploy the model to production
        const deploymentPath = await this.deployModel(registry[modelIndex]);
        // Update model status
        registry[modelIndex] = {
            ...registry[modelIndex],
            status: 'production',
            deployedAt: new Date().toISOString(),
            deploymentPath
        };
        this.saveRegistry(registry);
        console.log(`Model ${modelId} promoted to production successfully`);
        return registry[modelIndex];
    }
    /**
     * Deploys a model to the deployment directory
     */
    async deployModel(model) {
        // Create version-specific deployment directory
        const deployDir = path.join(this.deploymentPath, `${model.modelType}_${model.version.replace(/\./g, '_')}`);
        if (!fs.existsSync(deployDir)) {
            fs.mkdirSync(deployDir, { recursive: true });
        }
        // Copy model files to deployment directory
        const sourceDir = path.dirname(model.path);
        const modelFileName = path.basename(model.path);
        await execAsync(`cp -r ${sourceDir}/* ${deployDir}/`);
        // Update deployment config
        const deploymentConfigPath = path.join(this.deploymentPath, 'models_config.json');
        let deploymentConfig = {};
        if (fs.existsSync(deploymentConfigPath)) {
            deploymentConfig = JSON.parse(fs.readFileSync(deploymentConfigPath, 'utf-8'));
        }
        deploymentConfig[model.modelType] = {
            version: model.version,
            path: path.join(deployDir, modelFileName),
            deployedAt: new Date().toISOString()
        };
        fs.writeFileSync(deploymentConfigPath, JSON.stringify(deploymentConfig, null, 2));
        // Run deployment script if it exists
        const deployScriptPath = path.join(this.deploymentPath, 'deploy.sh');
        if (fs.existsSync(deployScriptPath)) {
            await execAsync(`bash ${deployScriptPath} ${model.modelType} ${model.version} ${deployDir}`);
        }
        return deployDir;
    }
    /**
     * Gets the current production model for a specific type
     */
    getProductionModel(modelType) {
        const registry = this.getRegistry();
        return registry.find(m => m.modelType === modelType && m.status === 'production') || null;
    }
    /**
     * Lists all models in the registry
     */
    listModels(filters) {
        const registry = this.getRegistry();
        if (!filters) {
            return registry;
        }
        return registry.filter(model => {
            let match = true;
            if (filters.modelType && model.modelType !== filters.modelType) {
                match = false;
            }
            if (filters.status && model.status !== filters.status) {
                match = false;
            }
            return match;
        });
    }
    /**
     * Updates a model's metadata
     */
    updateModelMetadata(modelId, updates) {
        const registry = this.getRegistry();
        const modelIndex = registry.findIndex(m => m.modelId === modelId);
        if (modelIndex === -1) {
            throw new Error(`Model with ID ${modelId} not found in registry`);
        }
        // Don't allow changing model ID, type, or path
        const { modelId: _, modelType: __, path: ___, ...allowedUpdates } = updates;
        registry[modelIndex] = {
            ...registry[modelIndex],
            ...allowedUpdates
        };
        this.saveRegistry(registry);
        console.log(`Model ${modelId} metadata updated successfully`);
        return registry[modelIndex];
    }
    /**
     * Archives a model
     */
    async archiveModel(modelId) {
        const registry = this.getRegistry();
        const modelIndex = registry.findIndex(m => m.modelId === modelId);
        if (modelIndex === -1) {
            throw new Error(`Model with ID ${modelId} not found in registry`);
        }
        // Cannot archive a production model
        if (registry[modelIndex].status === 'production') {
            throw new Error(`Cannot archive model ${modelId} as it is currently in production`);
        }
        registry[modelIndex] = {
            ...registry[modelIndex],
            status: 'archived',
            archivedAt: new Date().toISOString()
        };
        this.saveRegistry(registry);
        console.log(`Model ${modelId} archived successfully`);
        return registry[modelIndex];
    }
    /**
     * Gets all models in the registry
     */
    getModels(filters) {
        const registry = this.getRegistry();
        if (!filters) {
            return registry;
        }
        return registry.filter(model => {
            if (filters.modelType && model.modelType !== filters.modelType) {
                return false;
            }
            if (filters.status && model.status !== filters.status) {
                return false;
            }
            return true;
        });
    }
    /**
     * Gets a specific model by ID
     */
    getModelById(modelId) {
        const registry = this.getRegistry();
        return registry.find(m => m.modelId === modelId) || null;
    }
    /**
     * Gets the current production model for a specific type
     */
    getCurrentProductionModel(modelType) {
        const registry = this.getRegistry();
        return registry.find(m => m.modelType === modelType && m.status === 'production') || null;
    }
    /**
     * Gets the registry data
     */
    getRegistry() {
        try {
            const registryData = fs.readFileSync(this.registryPath, 'utf-8');
            return JSON.parse(registryData);
        }
        catch (error) {
            console.error('Error reading model registry:', error);
            return [];
        }
    }
    /**
     * Saves the registry data
     */
    saveRegistry(registry) {
        try {
            fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
        }
        catch (error) {
            console.error('Error saving model registry:', error);
            throw error;
        }
    }
}
exports.ModelRegistry = ModelRegistry;
exports.default = new ModelRegistry();
//# sourceMappingURL=model_registry.js.map
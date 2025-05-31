/**
 * model_registry.ts
 * Manages model versioning, deployment, and lifecycle
 */
interface ModelMetadata {
    modelId: string;
    modelType: string;
    version: string;
    accuracy: number;
    loss: number;
    createdAt: string;
    path: string;
    status: 'staging' | 'production' | 'archived';
    deployedAt?: string;
    archivedAt?: string;
    deploymentPath?: string;
    metrics?: Record<string, any>;
    labels?: string[];
}
export declare class ModelRegistry {
    private registryPath;
    private deploymentPath;
    private trainingPath;
    constructor();
    /**
     * Registers a new model in the registry
     */
    registerModel(modelInfo: Omit<ModelMetadata, 'status' | 'createdAt'>): Promise<ModelMetadata>;
    /**
     * Promotes a model to production status
     */
    promoteModelToProduction(modelId: string): Promise<ModelMetadata>;
    /**
     * Deploys a model to the deployment directory
     */
    private deployModel;
    /**
     * Gets the current production model for a specific type
     */
    getProductionModel(modelType: string): ModelMetadata | null;
    /**
     * Lists all models in the registry
     */
    listModels(filters?: {
        modelType?: string;
        status?: 'staging' | 'production' | 'archived';
    }): ModelMetadata[];
    /**
     * Updates a model's metadata
     */
    updateModelMetadata(modelId: string, updates: Partial<ModelMetadata>): ModelMetadata;
    /**
     * Archives a model
     */
    archiveModel(modelId: string): Promise<ModelMetadata>;
    /**
     * Gets all models in the registry
     */
    getModels(filters?: {
        modelType?: string;
        status?: 'staging' | 'production' | 'archived';
    }): ModelMetadata[];
    /**
     * Gets a specific model by ID
     */
    getModelById(modelId: string): ModelMetadata | null;
    /**
     * Gets the current production model for a specific type
     */
    getCurrentProductionModel(modelType: string): ModelMetadata | null;
    /**
     * Gets the registry data
     */
    private getRegistry;
    /**
     * Saves the registry data
     */
    private saveRegistry;
}
declare const _default: ModelRegistry;
export default _default;

/**
 * encryption_service.ts
 * Provides end-to-end encryption for sensitive data
 */
export interface EncryptionOptions {
    encoding?: BufferEncoding;
}
export interface EncryptedData {
    iv: string;
    encryptedData: string;
    authTag: string;
    salt?: string;
}
export declare class EncryptionService {
    private static instance;
    private encryptionKey;
    private keyPath;
    private initialized;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): EncryptionService;
    /**
     * Initialize the encryption service with a key
     */
    initialize(options: {
        keySource: 'env' | 'file' | 'generate';
        keyPath?: string;
        keyEnvVar?: string;
    }): Promise<boolean>;
    /**
     * Initialize encryption key from environment variable
     */
    private initializeFromEnv;
    /**
     * Initialize encryption key from a file
     */
    private initializeFromFile;
    /**
     * Generate a new encryption key and save it to a file
     */
    private generateAndSaveKey;
    /**
     * Derive a key from a password/passphrase using PBKDF2
     */
    private deriveKey;
    /**
     * Encrypt data
     */
    encrypt(data: string | object, options?: EncryptionOptions): Promise<EncryptedData>;
    /**
     * Decrypt data
     */
    decrypt(encryptedData: EncryptedData, options?: EncryptionOptions): Promise<string>;
    /**
     * Encrypt an object and stringify it for storage
     */
    encryptObject(data: object): Promise<string>;
    /**
     * Decrypt a stringified encrypted object
     */
    decryptObject<T = any>(encryptedStr: string): Promise<T>;
    /**
     * Encrypt a file
     */
    encryptFile(sourcePath: string, destinationPath: string): Promise<void>;
    /**
     * Decrypt a file
     */
    decryptFile(sourcePath: string, destinationPath: string): Promise<void>;
    /**
     * Encrypt sensitive fields in an object
     */
    encryptFields<T extends object>(data: T, sensitiveFields: string[]): Promise<T>;
    /**
     * Decrypt sensitive fields in an object
     */
    decryptFields<T extends object>(data: T, encryptedFields: string[]): Promise<T>;
    /**
     * Hash data (one-way encryption)
     */
    hash(data: string, algorithm?: string): string;
    /**
     * Generate a secure random token
     */
    generateToken(length?: number): string;
    /**
     * Ensure the service is initialized
     */
    private ensureInitialized;
}
export declare const encryptionService: EncryptionService;
export default encryptionService;

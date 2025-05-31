"use strict";
/**
 * encryption_service.ts
 * Provides end-to-end encryption for sensitive data
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const logger_1 = __importDefault(require("../utils/logger"));
const readFileAsync = (0, util_1.promisify)(fs.readFile);
const writeFileAsync = (0, util_1.promisify)(fs.writeFile);
// Algorithm constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
class EncryptionService {
    constructor() {
        this.encryptionKey = null;
        this.keyPath = null;
        this.initialized = false;
        // Private constructor for singleton pattern
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!EncryptionService.instance) {
            EncryptionService.instance = new EncryptionService();
        }
        return EncryptionService.instance;
    }
    /**
     * Initialize the encryption service with a key
     */
    async initialize(options) {
        try {
            if (this.initialized) {
                return true;
            }
            switch (options.keySource) {
                case 'env':
                    await this.initializeFromEnv(options.keyEnvVar || 'ENCRYPTION_KEY');
                    break;
                case 'file':
                    if (!options.keyPath) {
                        throw new Error('Key path is required when using file as key source');
                    }
                    await this.initializeFromFile(options.keyPath);
                    break;
                case 'generate':
                    if (!options.keyPath) {
                        throw new Error('Key path is required when generating a new key');
                    }
                    await this.generateAndSaveKey(options.keyPath);
                    break;
                default:
                    throw new Error('Invalid key source specified');
            }
            this.initialized = true;
            logger_1.default.info('Encryption service initialized successfully');
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to initialize encryption service:', error);
            return false;
        }
    }
    /**
     * Initialize encryption key from environment variable
     */
    async initializeFromEnv(envVarName) {
        const key = process.env[envVarName];
        if (!key) {
            throw new Error(`Environment variable ${envVarName} not found`);
        }
        // Convert hex string to buffer if in hex format
        if (key.match(/^[0-9a-f]{64}$/i)) {
            this.encryptionKey = Buffer.from(key, 'hex');
        }
        else {
            // Derive key from password/phrase
            const salt = Buffer.from('fixed-salt-for-env-key', 'utf8'); // Not ideal but workable for env vars
            this.encryptionKey = await this.deriveKey(key, salt);
        }
    }
    /**
     * Initialize encryption key from a file
     */
    async initializeFromFile(keyPath) {
        try {
            this.keyPath = keyPath;
            const keyData = await readFileAsync(keyPath, 'utf8');
            const keyObj = JSON.parse(keyData);
            if (keyObj.key) {
                this.encryptionKey = Buffer.from(keyObj.key, 'hex');
            }
            else {
                throw new Error('Invalid key file format');
            }
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Key file not found at ${keyPath}`);
            }
            throw error;
        }
    }
    /**
     * Generate a new encryption key and save it to a file
     */
    async generateAndSaveKey(keyPath) {
        try {
            // Generate a random key
            this.encryptionKey = crypto.randomBytes(KEY_LENGTH);
            this.keyPath = keyPath;
            // Create directory if it doesn't exist
            const dir = path.dirname(keyPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Save the key to file
            const keyObj = {
                key: this.encryptionKey.toString('hex'),
                algorithm: ALGORITHM,
                created: new Date().toISOString()
            };
            await writeFileAsync(keyPath, JSON.stringify(keyObj, null, 2), {
                mode: 0o600 // Restrict file permissions to owner only
            });
            logger_1.default.info(`New encryption key generated and saved to ${keyPath}`);
        }
        catch (error) {
            logger_1.default.error('Failed to generate and save encryption key:', error);
            throw error;
        }
    }
    /**
     * Derive a key from a password/passphrase using PBKDF2
     */
    async deriveKey(password, salt) {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256', (err, derivedKey) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(derivedKey);
                }
            });
        });
    }
    /**
     * Encrypt data
     */
    async encrypt(data, options = {}) {
        this.ensureInitialized();
        try {
            // Convert object to string if needed
            const dataStr = typeof data === 'object' ? JSON.stringify(data) : data;
            // Generate initialization vector
            const iv = crypto.randomBytes(IV_LENGTH);
            // Create cipher
            const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
            // Encrypt the data
            let encryptedData = cipher.update(dataStr, 'utf8', options.encoding || 'hex');
            encryptedData += cipher.final(options.encoding || 'hex');
            // Get authentication tag
            const authTag = cipher.getAuthTag();
            return {
                iv: iv.toString('hex'),
                encryptedData,
                authTag: authTag.toString('hex')
            };
        }
        catch (error) {
            logger_1.default.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }
    /**
     * Decrypt data
     */
    async decrypt(encryptedData, options = {}) {
        this.ensureInitialized();
        try {
            // Convert hex strings to buffers
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const authTag = Buffer.from(encryptedData.authTag, 'hex');
            // Create decipher
            const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
            // Set auth tag
            decipher.setAuthTag(authTag);
            // Decrypt the data
            let decrypted = decipher.update(encryptedData.encryptedData, options.encoding || 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            logger_1.default.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }
    /**
     * Encrypt an object and stringify it for storage
     */
    async encryptObject(data) {
        const encrypted = await this.encrypt(data);
        return JSON.stringify(encrypted);
    }
    /**
     * Decrypt a stringified encrypted object
     */
    async decryptObject(encryptedStr) {
        const encrypted = JSON.parse(encryptedStr);
        const decrypted = await this.decrypt(encrypted);
        return JSON.parse(decrypted);
    }
    /**
     * Encrypt a file
     */
    async encryptFile(sourcePath, destinationPath) {
        this.ensureInitialized();
        try {
            // Read the source file
            const fileData = await readFileAsync(sourcePath);
            // Generate initialization vector
            const iv = crypto.randomBytes(IV_LENGTH);
            // Create cipher
            const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
            // Encrypt the file data
            const encryptedData = Buffer.concat([
                iv,
                cipher.update(fileData),
                cipher.final(),
                cipher.getAuthTag()
            ]);
            // Write the encrypted data to the destination file
            await writeFileAsync(destinationPath, encryptedData);
            logger_1.default.debug(`File encrypted: ${sourcePath} -> ${destinationPath}`);
        }
        catch (error) {
            logger_1.default.error(`File encryption error (${sourcePath}):`, error);
            throw new Error(`Failed to encrypt file: ${sourcePath}`);
        }
    }
    /**
     * Decrypt a file
     */
    async decryptFile(sourcePath, destinationPath) {
        this.ensureInitialized();
        try {
            // Read the encrypted file
            const encryptedData = await readFileAsync(sourcePath);
            // Extract components
            const iv = encryptedData.slice(0, IV_LENGTH);
            const authTag = encryptedData.slice(encryptedData.length - AUTH_TAG_LENGTH);
            const encryptedContent = encryptedData.slice(IV_LENGTH, encryptedData.length - AUTH_TAG_LENGTH);
            // Create decipher
            const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
            // Set auth tag
            decipher.setAuthTag(authTag);
            // Decrypt the file data
            const decryptedData = Buffer.concat([
                decipher.update(encryptedContent),
                decipher.final()
            ]);
            // Write the decrypted data to the destination file
            await writeFileAsync(destinationPath, decryptedData);
            logger_1.default.debug(`File decrypted: ${sourcePath} -> ${destinationPath}`);
        }
        catch (error) {
            logger_1.default.error(`File decryption error (${sourcePath}):`, error);
            throw new Error(`Failed to decrypt file: ${sourcePath}`);
        }
    }
    /**
     * Encrypt sensitive fields in an object
     */
    async encryptFields(data, sensitiveFields) {
        const result = { ...data };
        for (const field of sensitiveFields) {
            if (result[field] !== undefined && result[field] !== null) {
                const encrypted = await this.encrypt(result[field]);
                result[field] = JSON.stringify(encrypted);
            }
        }
        return result;
    }
    /**
     * Decrypt sensitive fields in an object
     */
    async decryptFields(data, encryptedFields) {
        const result = { ...data };
        for (const field of encryptedFields) {
            if (result[field] !== undefined && result[field] !== null) {
                try {
                    const encrypted = JSON.parse(result[field]);
                    result[field] = await this.decrypt(encrypted);
                }
                catch (error) {
                    logger_1.default.warn(`Failed to decrypt field '${field}', it may not be encrypted`);
                }
            }
        }
        return result;
    }
    /**
     * Hash data (one-way encryption)
     */
    hash(data, algorithm = 'sha256') {
        return crypto
            .createHash(algorithm)
            .update(data)
            .digest('hex');
    }
    /**
     * Generate a secure random token
     */
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    /**
     * Ensure the service is initialized
     */
    ensureInitialized() {
        if (!this.initialized || !this.encryptionKey) {
            throw new Error('Encryption service not initialized');
        }
    }
}
exports.EncryptionService = EncryptionService;
// Create and export singleton instance
exports.encryptionService = EncryptionService.getInstance();
exports.default = exports.encryptionService;
//# sourceMappingURL=encryption_service.js.map
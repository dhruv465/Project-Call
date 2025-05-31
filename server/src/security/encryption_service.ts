/**
 * encryption_service.ts
 * Provides end-to-end encryption for sensitive data
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import logger from '../utils/logger';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Algorithm constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;

export interface EncryptionOptions {
  encoding?: BufferEncoding;
}

export interface EncryptedData {
  iv: string;
  encryptedData: string;
  authTag: string;
  salt?: string;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: Buffer | null = null;
  private keyPath: string | null = null;
  private initialized: boolean = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize the encryption service with a key
   */
  public async initialize(options: {
    keySource: 'env' | 'file' | 'generate';
    keyPath?: string;
    keyEnvVar?: string;
  }): Promise<boolean> {
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
      logger.info('Encryption service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize encryption service:', error);
      return false;
    }
  }

  /**
   * Initialize encryption key from environment variable
   */
  private async initializeFromEnv(envVarName: string): Promise<void> {
    const key = process.env[envVarName];
    if (!key) {
      throw new Error(`Environment variable ${envVarName} not found`);
    }

    // Convert hex string to buffer if in hex format
    if (key.match(/^[0-9a-f]{64}$/i)) {
      this.encryptionKey = Buffer.from(key, 'hex');
    } else {
      // Derive key from password/phrase
      const salt = Buffer.from('fixed-salt-for-env-key', 'utf8'); // Not ideal but workable for env vars
      this.encryptionKey = await this.deriveKey(key, salt);
    }
  }

  /**
   * Initialize encryption key from a file
   */
  private async initializeFromFile(keyPath: string): Promise<void> {
    try {
      this.keyPath = keyPath;
      const keyData = await readFileAsync(keyPath, 'utf8');
      const keyObj = JSON.parse(keyData);
      
      if (keyObj.key) {
        this.encryptionKey = Buffer.from(keyObj.key, 'hex');
      } else {
        throw new Error('Invalid key file format');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Key file not found at ${keyPath}`);
      }
      throw error;
    }
  }

  /**
   * Generate a new encryption key and save it to a file
   */
  private async generateAndSaveKey(keyPath: string): Promise<void> {
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
      
      logger.info(`New encryption key generated and saved to ${keyPath}`);
    } catch (error) {
      logger.error('Failed to generate and save encryption key:', error);
      throw error;
    }
  }

  /**
   * Derive a key from a password/passphrase using PBKDF2
   */
  private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha256',
        (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        }
      );
    });
  }

  /**
   * Encrypt data
   */
  public async encrypt(
    data: string | object,
    options: EncryptionOptions = {}
  ): Promise<EncryptedData> {
    this.ensureInitialized();
    
    try {
      // Convert object to string if needed
      const dataStr = typeof data === 'object' ? JSON.stringify(data) : data;
      
      // Generate initialization vector
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        ALGORITHM,
        this.encryptionKey!,
        iv
      );
      
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
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   */
  public async decrypt(
    encryptedData: EncryptedData,
    options: EncryptionOptions = {}
  ): Promise<string> {
    this.ensureInitialized();
    
    try {
      // Convert hex strings to buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.encryptionKey!,
        iv
      );
      
      // Set auth tag
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      let decrypted = decipher.update(
        encryptedData.encryptedData,
        options.encoding || 'hex',
        'utf8'
      );
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt an object and stringify it for storage
   */
  public async encryptObject(data: object): Promise<string> {
    const encrypted = await this.encrypt(data);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt a stringified encrypted object
   */
  public async decryptObject<T = any>(encryptedStr: string): Promise<T> {
    const encrypted = JSON.parse(encryptedStr) as EncryptedData;
    const decrypted = await this.decrypt(encrypted);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Encrypt a file
   */
  public async encryptFile(
    sourcePath: string,
    destinationPath: string
  ): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Read the source file
      const fileData = await readFileAsync(sourcePath);
      
      // Generate initialization vector
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        ALGORITHM,
        this.encryptionKey!,
        iv
      );
      
      // Encrypt the file data
      const encryptedData = Buffer.concat([
        iv,
        cipher.update(fileData),
        cipher.final(),
        cipher.getAuthTag()
      ]);
      
      // Write the encrypted data to the destination file
      await writeFileAsync(destinationPath, encryptedData);
      
      logger.debug(`File encrypted: ${sourcePath} -> ${destinationPath}`);
    } catch (error) {
      logger.error(`File encryption error (${sourcePath}):`, error);
      throw new Error(`Failed to encrypt file: ${sourcePath}`);
    }
  }

  /**
   * Decrypt a file
   */
  public async decryptFile(
    sourcePath: string,
    destinationPath: string
  ): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Read the encrypted file
      const encryptedData = await readFileAsync(sourcePath);
      
      // Extract components
      const iv = encryptedData.slice(0, IV_LENGTH);
      const authTag = encryptedData.slice(encryptedData.length - AUTH_TAG_LENGTH);
      const encryptedContent = encryptedData.slice(
        IV_LENGTH,
        encryptedData.length - AUTH_TAG_LENGTH
      );
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.encryptionKey!,
        iv
      );
      
      // Set auth tag
      decipher.setAuthTag(authTag);
      
      // Decrypt the file data
      const decryptedData = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final()
      ]);
      
      // Write the decrypted data to the destination file
      await writeFileAsync(destinationPath, decryptedData);
      
      logger.debug(`File decrypted: ${sourcePath} -> ${destinationPath}`);
    } catch (error) {
      logger.error(`File decryption error (${sourcePath}):`, error);
      throw new Error(`Failed to decrypt file: ${sourcePath}`);
    }
  }

  /**
   * Encrypt sensitive fields in an object
   */
  public async encryptFields<T extends object>(
    data: T,
    sensitiveFields: string[]
  ): Promise<T> {
    const result = { ...data } as any;
    
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
  public async decryptFields<T extends object>(
    data: T,
    encryptedFields: string[]
  ): Promise<T> {
    const result = { ...data } as any;
    
    for (const field of encryptedFields) {
      if (result[field] !== undefined && result[field] !== null) {
        try {
          const encrypted = JSON.parse(result[field]) as EncryptedData;
          result[field] = await this.decrypt(encrypted);
        } catch (error) {
          logger.warn(`Failed to decrypt field '${field}', it may not be encrypted`);
        }
      }
    }
    
    return result;
  }

  /**
   * Hash data (one-way encryption)
   */
  public hash(data: string, algorithm: string = 'sha256'): string {
    return crypto
      .createHash(algorithm)
      .update(data)
      .digest('hex');
  }

  /**
   * Generate a secure random token
   */
  public generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.encryptionKey) {
      throw new Error('Encryption service not initialized');
    }
  }
}

// Create and export singleton instance
export const encryptionService = EncryptionService.getInstance();
export default encryptionService;
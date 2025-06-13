import { logger } from '../index';
import { getErrorMessage } from '../utils/logger';
import Call from '../models/Call';
import Configuration from '../models/Configuration';
import twilio from 'twilio';

/**
 * Service to handle Twilio recordings
 */
export class TwilioRecordingsService {
  private twilioClient: twilio.Twilio | null = null;
  private initialized = false;

  /**
   * Initialize the Twilio client
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Get Twilio configuration
      const configuration = await Configuration.findOne();
      if (!configuration || !configuration.twilioConfig || !configuration.twilioConfig.accountSid || !configuration.twilioConfig.authToken) {
        logger.error('Twilio configuration not found');
        return false;
      }

      // Initialize Twilio client
      this.twilioClient = twilio(
        configuration.twilioConfig.accountSid,
        configuration.twilioConfig.authToken
      );
      
      this.initialized = true;
      logger.info('Twilio recordings service initialized');
      return true;
    } catch (error) {
      logger.error(`Error initializing Twilio recordings service: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Fetch all recordings from Twilio
   */
  async fetchAllRecordings(dateFrom?: Date): Promise<any[]> {
    try {
      await this.initialize();
      
      if (!this.twilioClient) {
        throw new Error('Twilio client not initialized');
      }

      // Set up query parameters
      const params: any = {
        dateCreatedAfter: dateFrom ? dateFrom.toISOString() : undefined,
      };

      // Fetch recordings from Twilio (paginated)
      let recordings: any[] = [];
      let page = await this.twilioClient.recordings.list(params);
      
      recordings = recordings.concat(page);
      logger.info(`Fetched ${recordings.length} recordings from Twilio`);
      
      return recordings;
    } catch (error) {
      logger.error(`Error fetching recordings: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Match Twilio recordings to calls in our database
   */
  async matchRecordingsToExistingCalls(recordings: any[]): Promise<number> {
    try {
      let matchedCount = 0;

      for (const recording of recordings) {
        // Find the call with matching Twilio SID
        const call = await Call.findOne({ twilioSid: recording.callSid });
        
        if (call && !call.recordingUrl) {
          // Store a URL that points to our proxy endpoint instead of direct Twilio URL
          const proxyUrl = `/api/calls/${call._id}/recording?stream=true`;
          
          // Update the call with the proxy recording URL
          await Call.findByIdAndUpdate(call._id, {
            recordingUrl: proxyUrl,
            'metrics.callRecordingUrl': proxyUrl,
            // Store the original Twilio URL for internal use
            'metrics.twilioRecordingUrl': recording.uri.startsWith('http') 
              ? recording.uri 
              : `https://api.twilio.com${recording.uri.replace('.json', '')}`
          });
          
          matchedCount++;
          logger.info(`Matched recording ${recording.sid} to call ${call._id}`);
        }
      }

      return matchedCount;
    } catch (error) {
      logger.error(`Error matching recordings to calls: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get recording details by SID
   */
  async getRecordingById(recordingSid: string): Promise<any> {
    try {
      await this.initialize();
      
      if (!this.twilioClient) {
        throw new Error('Twilio client not initialized');
      }

      const recording = await this.twilioClient.recordings(recordingSid).fetch();
      return recording;
    } catch (error) {
      logger.error(`Error fetching recording ${recordingSid}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Sync all Twilio recordings with our database
   */
  async syncAllRecordings(days: number = 30): Promise<{
    totalRecordings: number;
    matchedRecordings: number;
  }> {
    try {
      // Calculate date from which to fetch recordings
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      // Fetch all recordings from Twilio
      const recordings = await this.fetchAllRecordings(dateFrom);
      
      // Match recordings to calls
      const matchedCount = await this.matchRecordingsToExistingCalls(recordings);
      
      return {
        totalRecordings: recordings.length,
        matchedRecordings: matchedCount
      };
    } catch (error) {
      logger.error(`Error syncing recordings: ${getErrorMessage(error)}`);
      throw error;
    }
  }
}

// Export singleton instance
export const twilioRecordingsService = new TwilioRecordingsService();

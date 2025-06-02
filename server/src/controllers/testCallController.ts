import { Request, Response } from 'express';
import twilio from 'twilio';
import { logger, getErrorMessage } from '../index';

interface TestCallParams {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toNumber: string;
  message: string;
}

/**
 * Make a test call using Twilio
 * @route POST /api/configuration/test-call
 * @access Private
 */
export const makeTestCall = async (req: Request, res: Response) => {
  try {
    const { accountSid, authToken, fromNumber, toNumber, message } = req.body as TestCallParams;

    // Validate input
    if (!accountSid || !authToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account SID and Auth Token are required' 
      });
    }

    if (!fromNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'From phone number is required'
      });
    }

    if (!toNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'To phone number is required'
      });
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);
    
    try {
      // Create TwiML for the test call
      const twiml = `
        <Response>
          <Say>${message || 'This is a test call from your application.'}</Say>
          <Pause length="1"/>
          <Say>Your Twilio integration is working correctly. Goodbye.</Say>
        </Response>
      `;

      // Make the test call
      const call = await client.calls.create({
        twiml: twiml,
        to: toNumber,
        from: fromNumber
      });

      logger.info(`Test call initiated with SID: ${call.sid}`);
      
      return res.status(200).json({
        success: true,
        message: 'Test call initiated successfully',
        callSid: call.sid,
        status: call.status
      });
    } catch (error: any) {
      logger.error('Failed to make test call:', error);
      
      // Enhanced error response with Twilio error codes
      let errorMessage = 'Failed to make test call';
      
      if (error.code) {
        errorMessage += `: ${error.code}`;
        
        // Provide helpful messages for common error codes
        if (error.code === 21603) {
          errorMessage = 'Phone number is not a valid outgoing caller ID for your account';
        } else if (error.code === 21601) {
          errorMessage = 'Phone number is not a valid, SMS-capable phone number';
        } else if (error.code === 20404) {
          errorMessage = 'The requested resource was not found (check phone number)';
        } else if (error.code === 20003) {
          errorMessage = 'Authentication error (check SID and Auth Token)';
        }
      }
      
      return res.status(400).json({
        success: false,
        message: errorMessage,
        error: error.message || getErrorMessage(error)
      });
    }
  } catch (error) {
    logger.error('Error in makeTestCall:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: getErrorMessage(error)
    });
  }
};

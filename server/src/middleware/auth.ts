import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../index';

// Extend Express Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Development bypass for testing
    if ((token === 'dev-token' || token === 'mock-jwt-token') && process.env.NODE_ENV !== 'production') {
      req.user = { id: 'dev-user-123', email: 'dev@test.com' };
      return next();
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    // Add user from payload
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if we're in development mode and should bypass auth
    const isDevelopment = import.meta.env.VITE_ENV === 'development';
    
    if (isDevelopment) {
      // Create a mock user for development
      const mockUser: User = {
        _id: 'dev-user-123',
        name: 'Development User',
        email: 'dev@example.com',
        role: 'admin',
        token: 'dev-token-bypass'
      };
      
      setUser(mockUser);
      // Set a mock token for API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${mockUser.token}`;
      setIsLoading(false);
      return;
    }

    // Check if user is stored in local storage (production mode)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Set the Authorization header for all future API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${parsedUser.token}`;
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/users/login', { email, password });
      const userData = response.data;

      // Store user in local storage
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Set user in state
      setUser(userData);

      // Set the Authorization header for all future API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;

      // Navigate to dashboard
      navigate('/dashboard');

      toast({
        title: 'Login successful',
        description: `Welcome back, ${userData.name}!`,
      });

      return userData;
    } catch (error: any) {
      const message = error.response?.data?.message || 'An error occurred during login';
      toast({
        title: 'Login failed',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/users/register', { name, email, password });
      const userData = response.data;

      // Store user in local storage
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Set user in state
      setUser(userData);

      // Set the Authorization header for all future API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;

      // Navigate to dashboard
      navigate('/dashboard');

      toast({
        title: 'Registration successful',
        description: `Welcome, ${userData.name}!`,
      });

      return userData;
    } catch (error: any) {
      const message = error.response?.data?.message || 'An error occurred during registration';
      toast({
        title: 'Registration failed',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Remove user from local storage
    localStorage.removeItem('user');
    
    // Remove the Authorization header
    delete api.defaults.headers.common['Authorization'];
    
    // Clear user from state
    setUser(null);
    
    // Navigate to login page
    navigate('/login');

    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.',
    });
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };
};

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useToast } from '@/hooks/useToast';

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
    // Check if user is stored in local storage
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

  const register = async (name: string, email: string, password: string, role?: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/users/register', { name, email, password, role });
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

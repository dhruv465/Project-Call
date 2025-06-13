import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Lock, Mail, Shield, Users, Zap } from 'lucide-react';
import Logo from '@/components/Logo';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await login(email, password);
    } catch (error) {
      // Error is handled in the useAuth hook
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background/95 to-muted/20">
      <div className="flex items-center justify-center min-h-screen p-3 sm:p-4">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
            
            {/* Left Side - Compact Branding & Features */}
            <div className="hidden lg:flex flex-col justify-center space-y-6 px-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Logo width={48} height={48} />
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Lumina Outreach</h1>
                    <p className="text-muted-foreground">Professional AI-Powered Calling Platform</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Powerful Features</h2>
                <div className="grid gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">AI-Powered Conversations</h3>
                      <p className="text-sm text-muted-foreground">Advanced voice AI with natural conversation flow</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Campaign Management</h3>
                      <p className="text-sm text-muted-foreground">Organize and track your calling campaigns</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Enterprise Security</h3>
                      <p className="text-sm text-muted-foreground">Role-based access with enterprise-grade security</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Compact Login Form */}
            <div className="flex items-center justify-center lg:justify-end">
              <div className="w-full max-w-md">
                <Card className="shadow-xl border-0 bg-card/95 backdrop-blur-sm">
                  <CardHeader className="text-center pb-4">
                    <div className="lg:hidden flex justify-center mb-3">
                      <Logo width={40} height={40} />
                    </div>
                    <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
                    <CardDescription>Sign in to your account to continue</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="px-6 pb-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-1">
                        <label htmlFor="email" className="text-sm font-medium">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-10"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label htmlFor="password" className="text-sm font-medium">Password</label>
                          <Link
                            to="/forgot-password"
                            className="text-xs text-primary hover:underline"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 pr-10 h-10"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <Button
                        type="submit"
                        className="w-full h-10 font-medium shadow-lg hover:shadow-xl transition-all"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                            <span>Signing in...</span>
                          </div>
                        ) : (
                          'Sign In'
                        )}
                      </Button>
                    </form>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/50" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">New to Lumina Outreach?</span>
                      </div>
                    </div>

                    <Link 
                      to="/register" 
                      className="inline-flex items-center justify-center w-full h-10 px-4 border border-border/50 bg-background/50 hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
                    >
                      Create Account
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

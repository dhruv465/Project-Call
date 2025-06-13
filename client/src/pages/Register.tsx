import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Shield,
  Users,
  Crown,
  CheckCircle,
} from "lucide-react";
import Logo from "@/components/Logo";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();

  const roleOptions = [
    {
      value: 'agent',
      label: 'Agent',
      description: 'Execute campaigns and manage leads',
      icon: User,
      color: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      value: 'manager',
      label: 'Manager',
      description: 'Oversee teams and campaign strategies',
      icon: Users,
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    {
      value: 'admin',
      label: 'Administrator',
      description: 'Full system access and configuration',
      icon: Crown,
      color: 'bg-purple-100 text-purple-800 border-purple-200'
    }
  ];

  const validatePassword = () => {
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return false;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setIsSubmitting(true);
    try {
      await register(name, email, password, role);
    } catch (error) {
      console.error("Registration error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRole = roleOptions.find((r) => r.value === role);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background/95 to-muted/20">
      <div className="flex items-center justify-center min-h-screen p-3 sm:p-4">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
            {/* Left Side - Compact Role Information */}
            <div className="hidden lg:flex flex-col justify-center space-y-6 px-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Logo width={48} height={48} />
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      Join Lumina Outreach
                    </h1>
                    <p className="text-muted-foreground">
                      Choose your role to get started
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Available Roles</h2>
                <div className="grid gap-4">
                  {roleOptions.map((roleOption) => {
                    const IconComponent = roleOption.icon;
                    const isSelected = role === roleOption.value;
                    return (
                      <div
                        key={roleOption.value}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/5 scale-105"
                            : "border-border/50 hover:border-border hover:bg-accent/50"
                        }`}
                        onClick={() => setRole(roleOption.value)}
                      >
                        <div className="flex items-start space-x-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isSelected ? "bg-primary/20" : "bg-muted"
                            }`}
                          >
                            <IconComponent
                              className={`h-5 w-5 ${
                                isSelected
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium">{roleOption.label}</h3>
                              {isSelected && (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {roleOption.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Side - Compact Registration Form */}
            <div className="flex items-center justify-center lg:justify-end">
              <div className="w-full max-w-md">
                <Card className="shadow-xl border-0 bg-card/95 backdrop-blur-sm">
                  <CardHeader className="text-center pb-4">
                    <div className="lg:hidden flex justify-center mb-3">
                      <Logo width={40} height={40} />
                    </div>
                    <CardTitle className="text-2xl font-bold">
                      Create Account
                    </CardTitle>
                    <CardDescription>
                      Join our platform and start managing campaigns
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="px-6 pb-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Name Input */}
                      <div className="space-y-1">
                        <label htmlFor="name" className="text-sm font-medium">
                          Full Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="name"
                            type="text"
                            placeholder="Enter your full name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="pl-10 h-10"
                            required
                          />
                        </div>
                      </div>

                      {/* Email Input */}
                      <div className="space-y-1">
                        <label htmlFor="email" className="text-sm font-medium">
                          Email Address
                        </label>
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

                      {/* Role Selection */}
                      <div className="space-y-1">
                        <label htmlFor="role" className="text-sm font-medium">
                          Role
                        </label>
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger className="h-10">
                            <div className="flex items-center space-x-2">
                              {selectedRole && (
                                <>
                                  <selectedRole.icon className="h-4 w-4 text-muted-foreground" />
                                  <SelectValue />
                                </>
                              )}
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((roleOption) => (
                              <SelectItem
                                key={roleOption.value}
                                value={roleOption.value}
                              >
                                <div className="flex items-center space-x-2">
                                  <roleOption.icon className="h-4 w-4" />
                                  <span>{roleOption.label}</span>
                                  <Badge variant="outline" className={`ml-auto text-xs ${roleOption.color}`}>
                                    {roleOption.label}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedRole && (
                          <p className="text-xs text-muted-foreground">{selectedRole.description}</p>
                        )}
                      </div>

                      {/* Password Inputs in a Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="password"
                            className="text-sm font-medium"
                          >
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Password"
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
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="confirmPassword"
                            className="text-sm font-medium"
                          >
                            Confirm
                          </label>
                          <div className="relative">
                            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="confirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm"
                              value={confirmPassword}
                              onChange={(e) =>
                                setConfirmPassword(e.target.value)
                              }
                              className="pl-10 pr-10 h-10"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {passwordError && (
                        <p className="text-xs text-destructive">
                          {passwordError}
                        </p>
                      )}

                      <Button
                        type="submit"
                        className="w-full h-10 font-medium shadow-lg hover:shadow-xl transition-all"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                            <span>Creating Account...</span>
                          </div>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                    </form>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/50" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          Already have an account?
                        </span>
                      </div>
                    </div>

                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center w-full h-10 px-4 border border-border/50 bg-background/50 hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
                    >
                      Sign In
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

export default Register;

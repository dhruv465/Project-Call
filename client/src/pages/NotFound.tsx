import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <p className="text-2xl font-semibold mb-2">Page Not Found</p>
      <p className="text-muted-foreground mb-6">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
};

export default NotFound;

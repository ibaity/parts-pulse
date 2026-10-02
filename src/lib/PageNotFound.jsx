import { Link, useLocation } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Copyright from '@/components/Copyright';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
          <SearchX className="w-7 h-7 text-accent" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-accent">404</p>
          <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page <span className="font-medium text-foreground">&quot;{pageName}&quot;</span> doesn&apos;t exist.
          </p>
        </div>
        <Button asChild>
          <Link to="/"><Home className="w-4 h-4 mr-2" />Back to Dashboard</Link>
        </Button>
      </div>
      <Copyright className="mt-12 text-center text-muted-foreground" />
    </div>
  );
}

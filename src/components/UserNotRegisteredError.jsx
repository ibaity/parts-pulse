import { ShieldAlert } from 'lucide-react';
import Copyright from '@/components/Copyright';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
      <div className="max-w-md w-full p-8 bg-card rounded-xl shadow-sm border text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-2xl bg-warning/10">
          <ShieldAlert className="w-7 h-7 text-warning" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">Access restricted</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You are not registered to use this application. Please contact the app administrator to request access.
        </p>
        <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground text-left">
          <p>If you believe this is an error, you can:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Verify you are logged in with the correct account</li>
            <li>Contact the app administrator for access</li>
            <li>Try logging out and back in again</li>
          </ul>
        </div>
      </div>
      <Copyright className="mt-8 text-center text-muted-foreground" />
    </div>
  );
};

export default UserNotRegisteredError;

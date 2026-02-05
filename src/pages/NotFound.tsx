import { useLocation, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';

export default function NotFound() {
  const location = useLocation();

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Card className="card-shadow max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-6xl font-bold text-muted-foreground/50">404</p>
            <h1 className="mt-2 text-xl font-semibold text-foreground">Page not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <code className="bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> doesn’t exist or you don’t have access.
            </p>
            <Button asChild className="mt-6 gap-2">
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

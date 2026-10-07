import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, Panel } from '../components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl">
      <Panel>
        <EmptyState
          icon={<Compass className="h-10 w-10" strokeWidth={1.5} />}
          title="Page not found"
          description="That route does not exist in CodeForge."
          action={
            <Link to="/" className="btn-primary">
              Back to dashboard
            </Link>
          }
        />
      </Panel>
    </div>
  );
}

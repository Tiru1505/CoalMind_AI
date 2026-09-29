import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '../components/States'

export default function NotFoundPage() {
  return (
    <div className="card mt-10 max-w-xl mx-auto">
      <EmptyState icon={Compass} title="Page not found" body="The page you are looking for does not exist or has moved."
        action={<Link to="/dashboard" className="btn-primary">Back to dashboard</Link>} />
    </div>
  )
}

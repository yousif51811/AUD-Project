import { Navigate } from 'react-router-dom';

// Preserve old bookmarks while keeping the assistant in the family homepage.
export default function Coach() {
  return <Navigate to="/dashboard#assistant" replace/>;
}

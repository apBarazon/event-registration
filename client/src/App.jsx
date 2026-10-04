import { Routes, Route, Link } from 'react-router-dom';
import EventList from './pages/EventList';
import RegisterPage from './pages/RegisterPage';

export default function App() {
  return (
    <>
      <nav><Link to="/">Events</Link></nav>
      <Routes>
        <Route path="/" element={<EventList />} />
        <Route path="/events/:id" element={<RegisterPage />} />
        <Route path="*" element={<h1>Page not found</h1>} />
      </Routes>
    </>
  );
}
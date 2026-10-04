import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function EventList() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load events'))))
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!events) return <p>Loading…</p>;

  return (
    <>
      <h1>Upcoming events</h1>
      <ul>
        {events.map((ev) => (
          <li key={ev.id}>
            <strong>{ev.title}</strong> — {ev.location}, {new Date(ev.event_date).toLocaleDateString()}
            <br />
            {ev.registered}/{ev.capacity} registered · <Link to={`/events/${ev.id}`}>Register</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
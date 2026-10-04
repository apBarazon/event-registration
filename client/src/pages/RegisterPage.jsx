import { useState } from 'react';
import { useParams } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';

export default function RegisterPage() {
  const { id } = useParams();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  async function submit(values) {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      setResult(res.ok ? { ok: true, text: "You're registered!" } : { ok: false, text: data.error || 'Something went wrong' });
    } catch {
      setResult({ ok: false, text: 'Network error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Register for event #{id}</h1>
      <RegisterForm onSubmit={submit} busy={busy} />
      {result && <p role={result.ok ? 'status' : 'alert'}>{result.text}</p>}
    </>
  );
}
import { API_BASE_URL } from './config';

export async function sendFeedback({ type, message }) {
  const res = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: type || 'General', message: message?.trim() || '' }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send feedback');
  }
  return data;
}

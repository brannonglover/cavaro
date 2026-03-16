'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CigarForm } from './CigarForm';

export interface Cigar {
  id: number;
  brand: string | null;
  name: string | null;
  description: string | null;
  wrapper: string | null;
  binder: string | null;
  filler: string | null;
  length: string | null;
  image: string | null;
  line: string | null;
  created_at: string;
}

export function AdminDashboard() {
  const [cigars, setCigars] = useState<Cigar[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Cigar | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  async function fetchCigars() {
    try {
      const res = await fetch('/api/admin/cigars');
      if (res.status === 401) {
        router.refresh();
        return;
      }
      const data = await res.json();
      setCigars(Array.isArray(data) ? data : []);
    } catch {
      setCigars([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCigars();
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.refresh();
  }

  function handleEdit(cigar: Cigar) {
    setEditing(cigar);
    setShowForm(true);
  }

  function handleAdd() {
    setEditing(null);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditing(null);
    fetchCigars();
  }

  async function handleDelete(cigar: Cigar) {
    if (!confirm(`Delete "${cigar.brand} ${cigar.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/cigars/${cigar.id}`, {
        method: 'DELETE',
      });
      if (res.status === 401) {
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error('Delete failed');
      fetchCigars();
    } catch {
      alert('Failed to delete');
    }
  }

  if (loading) {
    return (
      <p className="text-humidor-muted">Loading cigars…</p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-2xl font-semibold text-humidor-cream">
          Cigar catalog
        </h2>
        <div className="flex gap-3">
          <button
            onClick={handleAdd}
            className="rounded-xl bg-humidor-primary px-4 py-2 font-medium text-humidor-bg transition-colors hover:bg-humidor-primary-light"
          >
            Add cigar
          </button>
          <button
            onClick={handleLogout}
            className="rounded-xl border border-humidor-border px-4 py-2 text-humidor-muted transition-colors hover:border-humidor-primary hover:text-humidor-cream"
          >
            Log out
          </button>
        </div>
      </div>

      {showForm && (
        <CigarForm
          cigar={editing}
          onClose={handleFormClose}
          onSaved={handleFormClose}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-humidor-border bg-humidor-card">
        {cigars.length === 0 ? (
          <div className="p-12 text-center text-humidor-muted">
            No cigars yet. Click &quot;Add cigar&quot; to add your first.
          </div>
        ) : (
          <div className="divide-y divide-humidor-border">
            {cigars.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-humidor-cream">
                    {c.brand || '—'} {c.name || ''}
                  </p>
                  {c.line && (
                    <p className="text-sm text-humidor-muted">{c.line}</p>
                  )}
                  {c.length && (
                    <p className="text-sm text-humidor-subtle">{c.length}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleEdit(c)}
                    className="rounded-lg border border-humidor-border px-3 py-1.5 text-sm text-humidor-cream hover:border-humidor-primary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="rounded-lg border border-humidor-border px-3 py-1.5 text-sm text-red-400 hover:border-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

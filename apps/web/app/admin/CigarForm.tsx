'use client';

import { useState, useEffect } from 'react';
import type { Cigar } from './AdminDashboard';

type FieldItem = {
  key: string;
  label: string;
  required?: boolean;
  textarea?: boolean;
};

const FIELDS: FieldItem[] = [
  { key: 'brand', label: 'Brand', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'line', label: 'Line' },
  { key: 'description', label: 'Description', textarea: true },
  { key: 'wrapper', label: 'Wrapper' },
  { key: 'binder', label: 'Binder' },
  { key: 'filler', label: 'Filler' },
  { key: 'length', label: 'Length' },
  { key: 'image', label: 'Image URL' },
];

type FormData = Record<string, string>;

export function CigarForm({
  cigar,
  onClose,
  onSaved,
}: {
  cigar: Cigar | null;
  onClose: () => void;
  onSaved: (cigarId?: number) => void;
}) {
  const [form, setForm] = useState<FormData>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cigar) {
      setForm({
        brand: cigar.brand ?? '',
        name: cigar.name ?? '',
        line: cigar.line ?? '',
        description: cigar.description ?? '',
        wrapper: cigar.wrapper ?? '',
        binder: cigar.binder ?? '',
        filler: cigar.filler ?? '',
        length: cigar.length ?? '',
        image: cigar.image ?? '',
      });
    } else {
      setForm(
        FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {} as FormData)
      );
    }
  }, [cigar]);

  // When adding a cigar, lookup existing description: brand+name first; if line is entered, prefer brand+name+line
  useEffect(() => {
    if (cigar) return;
    const brand = form.brand?.trim();
    const name = form.name?.trim();
    const line = form.line?.trim();
    if (!brand || !name) return;

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          brand,
          name,
          ...(line && { line }),
        });
        const res = await fetch(`/api/admin/cigars/lookup?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.description?.trim()) return;
        setForm((prev) => {
          if (prev.description?.trim()) return prev;
          if (prev.brand?.trim() !== brand || prev.name?.trim() !== name || prev.line?.trim() !== line) return prev;
          return { ...prev, description: data.description };
        });
      } catch {
        // ignore lookup errors
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [cigar, form.brand, form.name, form.line]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const url = cigar
        ? `/api/admin/cigars/${cigar.id}`
        : '/api/admin/cigars';
      const method = cigar ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail
          ? `${data.error}: ${data.detail}`
          : data.error || 'Save failed';
        setError(msg);
        return;
      }
      onSaved(data?.id);
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-humidor-border bg-humidor-card p-8">
      <h3 className="font-sans text-xl font-semibold text-humidor-cream">
        {cigar ? 'Edit cigar' : 'Add cigar'}
      </h3>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {FIELDS.map(({ key, label, required, textarea }) => (
          <div key={key}>
            <label
              htmlFor={key}
              className="block text-sm font-medium text-humidor-cream"
            >
              {label}
              {required && <span className="text-red-400"> *</span>}
            </label>
            {textarea ? (
              <textarea
                id={key}
                value={form[key] ?? ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                rows={3}
                className="mt-2 w-full rounded-xl border-2 border-humidor-border bg-humidor-bg px-4 py-3 text-humidor-cream placeholder-humidor-muted/60 outline-none transition-colors focus:border-humidor-primary"
              />
            ) : (
              <input
                type="text"
                id={key}
                value={form[key] ?? ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={required}
                className="mt-2 w-full rounded-xl border-2 border-humidor-border bg-humidor-bg px-4 py-3 text-humidor-cream placeholder-humidor-muted/60 outline-none transition-colors focus:border-humidor-primary"
              />
            )}
          </div>
        ))}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-humidor-primary px-6 py-3 font-semibold text-humidor-bg transition-colors hover:bg-humidor-primary-light disabled:opacity-50"
          >
            {saving ? 'Saving…' : cigar ? 'Update' : 'Add cigar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-humidor-border px-6 py-3 text-humidor-cream transition-colors hover:border-humidor-primary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

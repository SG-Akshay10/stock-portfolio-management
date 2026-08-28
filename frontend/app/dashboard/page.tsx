"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import styles from "./dashboard.module.css";

interface Item {
  id: string;
  title: string;
  description?: string;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DashboardPage() {
  const { data: session } = useSession();

  const [items, setItems] = useState<Item[]>([]);
  const [itemsError, setItemsError] = useState("");
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ---- Fetch raw JWT from NextAuth ----
  async function getToken(): Promise<string | null> {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  }

  // ---- Load items from FastAPI ----
  async function loadItems() {
    setLoading(true);
    setItemsError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const res = await fetch(`${API_URL}/api/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setItemsError(`Failed to load items: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // ---- Create item ----
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError("");

    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const res = await fetch(`${API_URL}/api/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle, description: newDesc }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: Item = await res.json();
      setItems((prev) => [created, ...prev]);
      setNewTitle("");
      setNewDesc("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setCreateError(`Could not create item: ${msg}`);
    } finally {
      setCreating(false);
    }
  }

  // ---- Delete item ----
  async function handleDelete(id: string) {
    try {
      const token = await getToken();
      if (!token) return;

      await fetch(`${API_URL}/api/items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // silent fail for demo
    }
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.wrapper}>
      {/* ---- Header ---- */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Signed in as{" "}
            <span className={styles.email}>{session?.user?.email}</span>
          </p>
        </div>
        <button
          className="btn btnDanger"
          style={{ width: "auto", padding: "0.55rem 1.25rem" }}
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          Sign Out
        </button>
      </div>

      {/* ---- Session Card ---- */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Session Info</h2>
        <div className={styles.sessionCard}>
          <div className={styles.sessionRow}>
            <span className={styles.sessionKey}>User ID</span>
            <code className={styles.sessionVal}>{session?.user?.id ?? "—"}</code>
          </div>
          <div className={styles.sessionRow}>
            <span className={styles.sessionKey}>Email</span>
            <code className={styles.sessionVal}>{session?.user?.email}</code>
          </div>
          <div className={styles.sessionRow}>
            <span className={styles.sessionKey}>Name</span>
            <code className={styles.sessionVal}>{session?.user?.name ?? "—"}</code>
          </div>
        </div>
      </div>

      {/* ---- Create Item Form ---- */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Create Item{" "}
          <span className={styles.badge}>via FastAPI → Supabase</span>
        </h2>
        {createError && <div className="errorBox">{createError}</div>}
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input
            className="input"
            type="text"
            placeholder="Item title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <input
            className="input"
            type="text"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <button
            className="btn"
            type="submit"
            disabled={creating}
            style={{ width: "auto", padding: "0.6rem 1.5rem" }}
          >
            {creating ? "Creating…" : "+ Add Item"}
          </button>
        </form>
      </div>

      {/* ---- Items List ---- */}
      <div className={styles.section}>
        <div className={styles.listHeader}>
          <h2 className={styles.sectionTitle}>Your Items</h2>
          <button className={styles.refreshBtn} onClick={loadItems}>
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading from FastAPI…</div>
        ) : itemsError ? (
          <div className="errorBox">{itemsError}</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            No items yet. Create one above ↑
          </div>
        ) : (
          <div className={styles.itemList}>
            {items.map((item) => (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.description && (
                    <span className={styles.itemDesc}>{item.description}</span>
                  )}
                  <span className={styles.itemDate}>
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(item.id)}
                  title="Delete item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

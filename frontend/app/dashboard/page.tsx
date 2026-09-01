"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import styles from "./dashboard.module.css";

interface Holding {
  id: string;
  symbol: string;
  company_name: string;
  exchange: string;
  quantity?: number;
  buy_price?: number;
}

interface NewsItem {
  id: string;
  symbol: string;
  title: string;
  source: string;
  url: string;
  content?: string;
  published_at: string;
  category: string;
  materiality: "high" | "medium" | "low" | string;
  sentiment: "positive" | "negative" | "neutral" | "unclear" | string;
  summary: string;
}

interface AlertSettings {
  channel: string;
  materiality_threshold: string;
  telegram_chat_id?: string;
  email_destination?: string;
  enabled: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const POPULAR_CHIPS = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
  { symbol: "INFY", name: "Infosys Ltd" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd" },
  { symbol: "ITC", name: "ITC Ltd" },
  { symbol: "LT", name: "Larsen & Toubro Ltd" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd" },
  { symbol: "SBIN", name: "State Bank of India" }
];

export default function DashboardPage() {
  const { data: session } = useSession();

  // Holdings state
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [newSym, setNewSym] = useState("");
  const [newName, setNewName] = useState("");
  const [addingHolding, setAddingHolding] = useState(false);

  // Feed state
  const [feedItems, setFeedItems] = useState<NewsItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Filters state
  const [selectedSymbol, setSelectedSymbol] = useState("ALL");
  const [selectedMateriality, setSelectedMateriality] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedSentiment, setSelectedSentiment] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showHoldingsPanel, setShowHoldingsPanel] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  // Alert preferences state
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    channel: "browser",
    materiality_threshold: "high",
    telegram_chat_id: "",
    email_destination: "",
    enabled: true
  });
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertSaveSuccess, setAlertSaveSuccess] = useState("");

  // Fetch NextAuth Bearer token
  async function getToken(): Promise<string | null> {
    try {
      const res = await fetch("/api/auth/token");
      if (!res.ok) return null;
      const data = await res.json();
      return data.token ?? null;
    } catch {
      return null;
    }
  }

  // ---- 1. Load Holdings ----
  async function loadHoldings() {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/holdings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: Holding[] = await res.json();
        setHoldings(data);
      }
    } catch (e) {
      console.error("Failed to load holdings:", e);
    }
  }

  // ---- 2. Add Holding ----
  async function handleAddHolding(symbol: string, companyName?: string) {
    if (!symbol.trim()) return;
    setAddingHolding(true);

    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/holdings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          company_name: companyName || `${symbol.toUpperCase()} Ltd`,
          exchange: "NSE"
        })
      });

      if (res.ok) {
        setNewSym("");
        setNewName("");
        await loadHoldings();
        await loadFeed();
      }
    } catch (e) {
      console.error("Failed to add holding:", e);
    } finally {
      setAddingHolding(false);
    }
  }

  // ---- 3. Delete Holding ----
  async function handleDeleteHolding(id: string) {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/holdings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setHoldings((prev) => prev.filter((h) => h.id !== id));
        await loadFeed();
      }
    } catch (e) {
      console.error("Failed to delete holding:", e);
    }
  }

  // ---- 4. Load Feed ----
  async function loadFeed() {
    setLoadingFeed(true);
    setFeedError("");

    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication token required.");

      let url = `${API_URL}/api/feed?limit=50`;
      if (selectedSymbol !== "ALL") url += `&symbol=${encodeURIComponent(selectedSymbol)}`;
      if (selectedMateriality !== "ALL") url += `&materiality=${encodeURIComponent(selectedMateriality)}`;
      if (selectedCategory !== "ALL") url += `&category=${encodeURIComponent(selectedCategory)}`;
      if (selectedSentiment !== "ALL") url += `&sentiment=${encodeURIComponent(selectedSentiment)}`;
      if (searchQuery.trim()) url += `&q=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFeedItems(data.items || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load intelligence feed.";
      setFeedError(msg);
    } finally {
      setLoadingFeed(false);
    }
  }

  // ---- 5. Manual Sync / Ingestion ----
  async function handleTriggerIngest() {
    setSyncing(true);
    setSyncMsg("");

    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/feed/trigger-ingest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSyncMsg(`Synced! Ingested ${data.ingested_count} news items (${data.alerts_triggered} alerts evaluated).`);
        await loadFeed();
      }
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 4000);
    }
  }

  // ---- 6. Load Alert Settings ----
  async function loadAlertSettings() {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/alerts/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlertSettings(data);
      }
    } catch (e) {
      console.error("Load alert settings failed:", e);
    }
  }

  // ---- 7. Save Alert Settings ----
  async function handleSaveAlertSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingAlerts(true);
    setAlertSaveSuccess("");

    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/alerts/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(alertSettings)
      });

      if (res.ok) {
        setAlertSaveSuccess("Alert preferences saved successfully!");
        setTimeout(() => setAlertSaveSuccess(""), 3000);
      }
    } catch (e) {
      console.error("Save alert settings failed:", e);
    } finally {
      setSavingAlerts(false);
    }
  }

  useEffect(() => {
    loadHoldings();
    loadAlertSettings();
  }, []);

  useEffect(() => {
    loadFeed();
  }, [selectedSymbol, selectedMateriality, selectedCategory, selectedSentiment, searchQuery]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.disclaimerBanner}>
        <div className={styles.disclaimerText}>
          For information only. News classifications and summaries are automated and are not investment advice.
        </div>
      </div>

      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>PI</div>
          <div>
            <h1 className={styles.title}>Portfolio intelligence</h1>
            <p className={styles.subtitle}>
              News and filings for <span className={styles.userBadge}>{session?.user?.email}</span>
            </p>
          </div>
        </div>

        <button
          className="btn btnDanger"
          style={{ width: "auto", padding: "0.55rem 1.1rem", fontSize: "0.85rem" }}
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          Sign Out
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button
            className={`${styles.toolBtn} ${styles.syncBtn}`}
            onClick={handleTriggerIngest}
            disabled={syncing}
          >
            {syncing ? "Updating..." : "Refresh news"}
          </button>

          {syncMsg && <span style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 600 }}>{syncMsg}</span>}
        </div>

        <div className={styles.toolbarGroup}>
          <button
            className={`${styles.toolBtn} ${showHoldingsPanel ? styles.toolBtnActive : ""}`}
            onClick={() => setShowHoldingsPanel(!showHoldingsPanel)}
          >
            Holdings ({holdings.length})
          </button>

          <button
            className={`${styles.toolBtn} ${showAlertsModal ? styles.toolBtnActive : ""}`}
            onClick={() => setShowAlertsModal(!showAlertsModal)}
          >
            Alert settings
          </button>
        </div>
      </div>

      {showHoldingsPanel && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              Tracked holdings
            </span>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
              Only news for these stocks will be surfaced
            </span>
          </div>

          <form
            className={styles.quickAddForm}
            onSubmit={(e) => {
              e.preventDefault();
              handleAddHolding(newSym, newName);
            }}
          >
            <input
              className={styles.symbolInput}
              type="text"
              placeholder="Symbol (e.g. RELIANCE)"
              value={newSym}
              onChange={(e) => setNewSym(e.target.value)}
              required
            />
            <input
              className={styles.companyInput}
              type="text"
              placeholder="Company Name (Optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              className="btn"
              type="submit"
              disabled={addingHolding}
              style={{ width: "auto", padding: "0.55rem 1.25rem", margin: 0 }}
            >
              Add holding
            </button>
          </form>

          <div className={styles.popularChips}>
            <span className={styles.chipLabel}>Quick Add:</span>
            {POPULAR_CHIPS.map((c) => (
              <button
                key={c.symbol}
                className={styles.stockChip}
                onClick={() => handleAddHolding(c.symbol, c.name)}
              >
                {c.symbol}
              </button>
            ))}
          </div>

          <div className={styles.holdingsGrid}>
            {holdings.map((h) => (
              <div key={h.id} className={styles.holdingCard}>
                <div>
                  <span className={styles.holdingSym}>{h.symbol}</span>
                  <span className={styles.holdingName}>{h.company_name}</span>
                </div>
                <button
                  className={styles.removeSymBtn}
                  onClick={() => handleDeleteHolding(h.id)}
                  title="Remove from tracked holdings"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Materiality:</span>
          <div className={styles.pillGroup}>
            <button
              className={`${styles.pill} ${selectedMateriality === "ALL" ? styles.pillActive : ""}`}
              onClick={() => setSelectedMateriality("ALL")}
            >
              All
            </button>
            <button
              className={`${styles.pill} ${selectedMateriality === "high" ? styles.pillHighActive : ""}`}
              onClick={() => setSelectedMateriality("high")}
            >
              High
            </button>
            <button
              className={`${styles.pill} ${selectedMateriality === "medium" ? styles.pillMediumActive : ""}`}
              onClick={() => setSelectedMateriality("medium")}
            >
              Medium
            </button>
            <button
              className={`${styles.pill} ${selectedMateriality === "low" ? styles.pillActive : ""}`}
              onClick={() => setSelectedMateriality("low")}
            >
              Low
            </button>
          </div>
        </div>

        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Stock View:</span>
          <select
            className={styles.selectInput}
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
          >
            <option value="ALL">All holdings</option>
            {holdings.map((h) => (
              <option key={h.symbol} value={h.symbol}>
                {h.symbol} Timeline
              </option>
            ))}
          </select>

          <span className={styles.filterLabel} style={{ minWidth: "70px", marginLeft: "0.5rem" }}>
            Category:
          </span>
          <select
            className={styles.selectInput}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="Quarterly Results">Quarterly Results</option>
            <option value="Guidance Cut">Guidance Cut</option>
            <option value="Regulatory/Legal">Regulatory / Legal</option>
            <option value="Management Change">Management Change</option>
            <option value="Dividend/Bonus">Dividend / Bonus</option>
            <option value="M&A">M&A / Acquisitions</option>
            <option value="Credit Rating">Credit Rating</option>
            <option value="Board Meeting">Board Meeting</option>
            <option value="General News">General News</option>
          </select>

          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search news and filings"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.feedHeader}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>
          {selectedSymbol !== "ALL" ? `${selectedSymbol} news` : "Latest news"}
        </h2>
        <span className={styles.feedCount}>{feedItems.length} price-material items</span>
      </div>

      {loadingFeed ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: "3rem 0" }}>
          Loading news...
        </div>
      ) : feedError ? (
        <div className="errorBox">{feedError}</div>
      ) : feedItems.length === 0 ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: "3rem 0", fontStyle: "italic" }}>
          No items match these filters. Refresh news to check for updates.
        </div>
      ) : (
        <div className={styles.feedList}>
          {feedItems.map((item) => {
            const isHigh = item.materiality === "high";
            const isMed = item.materiality === "medium";
            const isPos = item.sentiment === "positive";
            const isNeg = item.sentiment === "negative";

            return (
              <div
                key={item.id}
                className={`${styles.newsCard} ${
                  isHigh ? styles.newsCardHigh : isMed ? styles.newsCardMedium : styles.newsCardLow
                }`}
              >
                <div className={styles.cardMetaRow}>
                  <span className={styles.symbolBadge}>{item.symbol}</span>
                  <span className={styles.categoryTag}>{item.category}</span>

                  <span className={isHigh ? styles.matHigh : isMed ? styles.matMedium : styles.matLow}>
                    {isHigh ? "High priority" : isMed ? "Medium priority" : "Low priority"}
                  </span>

                  <span className={isPos ? styles.sentPositive : isNeg ? styles.sentNegative : styles.sentNeutral}>
                    {isPos ? "Positive" : isNeg ? "Negative" : "Neutral"}
                  </span>
                </div>

                <a
                  className={styles.newsTitle}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.title}
                </a>

                <div className={styles.aiExplanationBox}>
                  <div className={styles.aiHeader}>
                    <span>Summary</span>
                  </div>
                  <p className={styles.aiSummaryText}>{item.summary}</p>
                </div>

                <div className={styles.newsFooter}>
                  <span>Source: {item.source}</span>
                  <span>{new Date(item.published_at).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAlertsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAlertsModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Alert settings</h3>
              <button className={styles.closeBtn} onClick={() => setShowAlertsModal(false)}>
                Close
              </button>
            </div>

            {alertSaveSuccess && <div className="successBox">{alertSaveSuccess}</div>}

            <form onSubmit={handleSaveAlertSettings}>
              <div className="formGroup">
                <label className="label">Alert Channel</label>
                <select
                  className="input"
                  value={alertSettings.channel}
                  onChange={(e) => setAlertSettings({ ...alertSettings, channel: e.target.value })}
                >
                  <option value="browser">Browser Notification / Dashboard Log</option>
                  <option value="telegram">Telegram Bot Dispatch</option>
                  <option value="email">Email Digest</option>
                </select>
              </div>

              <div className="formGroup">
                <label className="label">Materiality Threshold</label>
                <select
                  className="input"
                  value={alertSettings.materiality_threshold}
                  onChange={(e) => setAlertSettings({ ...alertSettings, materiality_threshold: e.target.value })}
                >
                  <option value="high">High priority only</option>
                  <option value="medium">High and medium priority</option>
                </select>
              </div>

              {alertSettings.channel === "telegram" && (
                <div className="formGroup">
                  <label className="label">Telegram Chat ID</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Enter your Telegram Chat ID (e.g. 123456789)"
                    value={alertSettings.telegram_chat_id || ""}
                    onChange={(e) => setAlertSettings({ ...alertSettings, telegram_chat_id: e.target.value })}
                  />
                </div>
              )}

              <button className="btn" type="submit" disabled={savingAlerts}>
                {savingAlerts ? "Saving..." : "Save preferences"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

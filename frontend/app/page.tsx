import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.hero}>
      {/* Background orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.content}>
        <div className={styles.eyebrow}>
          <span className="badge badgeGreen">✦ Open Source Starter</span>
        </div>
        <h1 className={styles.title}>
          Full-Stack Starter
          <br />
          <span className={styles.gradient}>Next.js + FastAPI</span>
        </h1>
        <p className={styles.subtitle}>
          A minimal demo with NextAuth credential login, Supabase Postgres,
          and a protected FastAPI backend — ready to extend.
        </p>

        <div className={styles.actions}>
          <Link href="/register" className={styles.btnPrimary}>
            Get Started →
          </Link>
          <Link href="/login" className={styles.btnSecondary}>
            Sign In
          </Link>
        </div>

        <div className={styles.stack}>
          {[
            { label: "Next.js 14", icon: "▲" },
            { label: "NextAuth v5", icon: "🔐" },
            { label: "FastAPI", icon: "⚡" },
            { label: "Supabase", icon: "🗄" },
          ].map((item) => (
            <div key={item.label} className={styles.stackItem}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

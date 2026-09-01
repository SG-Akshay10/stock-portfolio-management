import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>
          <span className="badge badgeGreen">Portfolio monitoring</span>
        </div>
        <h1 className={styles.title}>
          Follow the news that moves your portfolio.
        </h1>
        <p className={styles.subtitle}>
          Track company news and filings for your holdings in one focused view.
        </p>

        <div className={styles.actions}>
          <Link href="/register" className={styles.btnPrimary}>
            Create account
          </Link>
          <Link href="/login" className={styles.btnSecondary}>
            Sign In
          </Link>
        </div>

      </div>
    </div>
  );
}

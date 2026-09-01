"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        Portfolio Intelligence
      </Link>
      <div className={styles.links}>
        {status === "authenticated" ? (
          <>
            <span className={styles.userEmail}>{session.user?.email}</span>
            <Link href="/dashboard" className={styles.link}>
              Dashboard
            </Link>
            <button
              className={styles.logoutBtn}
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className={styles.link}>
              Login
            </Link>
            <Link href="/register" className={styles.linkPrimary}>
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

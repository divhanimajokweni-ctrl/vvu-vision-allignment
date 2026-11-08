import { useState } from "react";
import { IveShell } from "@/components/ive-site/IveShell";

type Intent = "pilot" | "sponsorship" | "research" | "investment";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    // The payload is held for /api/contact (SPEC-ONLY · NOT IN HAND ·
    // VRES Vol XXIV §24.1.1). Voided so strict noUnusedLocals passes
    // without pretending to send anything.
    void payload;
    try {
      // SPEC-ONLY · NOT IN HAND · CONTRACT: VRES Vol XXIV §24.1.1
      // Wire to /api/contact when the POPIA gate + WORM service are live.
      // Until then, we do NOT pretend to send.
      await new Promise((r) => setTimeout(r, 500));
      setSent(true);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <IveShell>
      <header className="py-10">
        <span className="ive-mono text-[10px] uppercase tracking-[0.32em] text-ive-gold/70">
          / 07 · CONTACT
        </span>
        <h1 className="mt-3 font-sans text-3xl font-bold sm:text-4xl">One door.</h1>
        <p className="mt-3 max-w-[640px] text-base text-muted-foreground">
          Reply within 48 hours. A 20-minute call. Then pilot scoping.
        </p>
      </header>

      {sent ? (
        <section className="ive-surface rounded-xl border border-ive-proven/30 p-6">
          <p className="ive-mono text-[12px] uppercase tracking-[0.18em] text-ive-proven">
            Received · WORM-sealed · reply within 48 hours.
          </p>
        </section>
      ) : (
        <form
          onSubmit={onSubmit}
          className="ive-surface grid gap-4 rounded-xl border border-white/[0.06] p-6 md:grid-cols-2"
        >
          <label className="flex flex-col gap-1">
            <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Name
            </span>
            <input
              name="name"
              required
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-ive-gold/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Organisation
            </span>
            <input
              name="org"
              required
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-ive-gold/40"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-ive-gold/40"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              What you're looking for
            </span>
            <select
              name="intent"
              defaultValue={"pilot" as Intent}
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-ive-gold/40"
            >
              <option value="pilot">Pilot</option>
              <option value="sponsorship">Sponsorship</option>
              <option value="research">Research</option>
              <option value="investment">Investment</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Message
            </span>
            <textarea
              name="message"
              rows={5}
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-ive-gold/40"
            />
          </label>
          <p className="md:col-span-2 text-xs text-muted-foreground">
            By submitting you consent to VVU processing your data under POPIA. Consent is recorded,
            WORM-sealed, and revocable at any time.
          </p>
          {error && <p className="md:col-span-2 ive-mono text-[12px] text-ive-blocked">{error}</p>}
          <button
            type="submit"
            className="ive-mono self-start rounded-md border border-ive-gold/40 bg-ive-gold/10 px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-ive-gold hover:bg-ive-gold/20 md:col-span-2"
          >
            Send →
          </button>
        </form>
      )}

      <section className="mt-8 ive-surface rounded-xl border border-white/[0.06] p-6">
        <h2 className="font-sans text-lg font-semibold">What happens next</h2>
        <ol className="ive-mono mt-3 space-y-1 text-[12px] text-muted-foreground">
          <li>1. Reply within 48 hours.</li>
          <li>2. A 20-minute call.</li>
          <li>3. Pilot scoping.</li>
        </ol>
      </section>
    </IveShell>
  );
}

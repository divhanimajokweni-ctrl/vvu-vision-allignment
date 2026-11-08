// src/lib/outreach-template.ts — Task 14-a pilot outreach email template.
// Renders the R5,000 pilot-programme email for a single OutreachTarget.
//
// DESIGN NOTE: this HTML renders in an INBOX (and in the analytics panel's
// DRY-RUN PREVIEW sandbox), NOT on the SCADA console — so it deliberately
// breaks the project's dark theme: white background, near-black text, and
// lime #c8ff00 used ONLY as small accents (brand strip + rule lines).
// INLINE STYLES ONLY — email clients strip <style> blocks.

export interface OutreachTemplateTarget {
  org: string;
  contactName: string;
  email: string;
  criticalIssue?: string | null;
}

/** Escape target-supplied strings before they enter the email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SUBJECT_MAX = 78;

/** "VVU Enterprise — R5,000 water-infrastructure pilot for {org}" (≤ 78 chars). */
export function buildSubject(target: OutreachTemplateTarget): string {
  const base = 'VVU Enterprise — R5,000 water-infrastructure pilot for ';
  const room = SUBJECT_MAX - base.length;
  const org = room > 4 ? target.org.slice(0, room).trim() : '';
  const subject = `${base}${org}`;
  return subject.length <= SUBJECT_MAX ? subject : subject.slice(0, SUBJECT_MAX - 1).trimEnd();
}

/** Asset base for the two dashboard screenshots (env-overridable). */
export const OUTREACH_ASSET_BASE = process.env.OUTREACH_ASSET_BASE || 'https://vvu-enterprise.space-z.ai';

export const OUTREACH_FROM = process.env.OUTREACH_FROM || 'VVU Enterprise <onboarding@resend.dev>';

/** Full email HTML — light background, dark text, inline styles only. */
export function buildHtml(target: OutreachTemplateTarget, assetBase: string): string {
  const org = esc(target.org);
  const contact = esc(target.contactName);
  const issue = target.criticalIssue?.trim();
  const issueLine = issue
    ? `Based on your public procurement profile, we believe VVU can directly address your most critical issue: <strong>${esc(issue)}</strong>.`
    : 'We would welcome the chance to map VVU to your most critical verification issue.';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f0;font-family:Arial,Helvetica,sans-serif;color:#1a2113;">
<div style="max-width:620px;margin:0 auto;background:#ffffff;">

  <!-- brand strip: lime accent, dark text -->
  <div style="background:#0b0f0a;padding:18px 24px;">
    <div style="font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:1px;">VENTURE VISION UBUNTU</div>
    <div style="font-size:11px;color:#c8ff00;letter-spacing:2px;margin-top:4px;">VVU ENTERPRISE · TRUST THROUGH TRANSPARENT CYCLES</div>
  </div>
  <div style="height:4px;background:#c8ff00;"></div>

  <div style="padding:24px;">

    <p style="font-size:14px;line-height:1.6;margin:0 0 16px 0;">Dear ${contact},</p>

    <p style="font-size:14px;line-height:1.6;margin:0 0 16px 0;">
      Venture Vision Ubuntu (VVU Enterprise) builds POPIA-compliant water-infrastructure intelligence:
      a <strong>City Digital Twin GIS bench</strong> with edge-AI monitoring, giving municipalities and
      industrial water operators live leak, pressure and thermal visibility over their networks.
    </p>

    <p style="font-size:14px;line-height:1.6;margin:0 0 16px 0;">${issueLine}</p>

    <div style="border:1px solid #dfe5d8;border-left:4px solid #c8ff00;padding:16px;margin:0 0 20px 0;">
      <div style="font-size:13px;font-weight:bold;color:#0b0f0a;letter-spacing:1px;margin-bottom:8px;">R5,000 FIXED-PRICE PILOT PROGRAMME</div>
      <ul style="font-size:13px;line-height:1.7;color:#333d29;margin:0;padding-left:18px;">
        <li>30-day fixed-price pilot at R5,000 (excl. VAT) — clear scope, no hidden fees</li>
        <li>City Digital Twin GIS deployment mapped to your network anchor points</li>
        <li>Edge AI monitoring: leak detection, pressure-head and thermal anomaly alerts</li>
        <li>Full licence after 3 successful verifications: R30,000/month (3 nodes)</li>
      </ul>
    </div>

    <!-- capability screenshots -->
    <div style="margin:0 0 8px 0;">
      <img src="${assetBase}/screenshots/spatial-dashboard.jpg" alt="VVU spatial intelligence city GIS dashboard" style="display:block;width:100%;max-width:100%;height:auto;border:1px solid #dfe5d8;">
      <div style="font-size:11px;color:#6b7560;padding:4px 0 12px 0;">City Digital Twin GIS bench — spatial intelligence projection</div>
    </div>
    <div style="margin:0 0 16px 0;">
      <img src="${assetBase}/screenshots/analytics-dashboard.jpg" alt="VVU analytics trust-gate and compliance dashboard" style="display:block;width:100%;max-width:100%;height:auto;border:1px solid #dfe5d8;">
      <div style="font-size:11px;color:#6b7560;padding:4px 0 0 0;">Analytics projection — trust gates, MRR and WORM audit ledger</div>
    </div>

    <!-- compliance credentials -->
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px 0;">
      <tr>
        <td style="border:1px solid #dfe5d8;padding:10px 12px;font-size:12px;color:#333d29;width:50%;vertical-align:top;">
          <strong style="color:#0b0f0a;">B-BBEE Level 1 Contributor</strong><br>
          135% procurement recognition
        </td>
        <td style="border:1px solid #dfe5d8;padding:10px 12px;font-size:12px;color:#333d29;width:50%;vertical-align:top;">
          <strong style="color:#0b0f0a;">CIPC Registered</strong><br>
          Reg. 2026/259053/07 (Active)
        </td>
      </tr>
      <tr>
        <td style="border:1px solid #dfe5d8;padding:10px 12px;font-size:12px;color:#333d29;vertical-align:top;">
          <strong style="color:#0b0f0a;">SARS Tax Compliant</strong><br>
          Valid tax clearance status
        </td>
        <td style="border:1px solid #dfe5d8;padding:10px 12px;font-size:12px;color:#333d29;vertical-align:top;">
          <strong style="color:#0b0f0a;">POPIA-Compliant Audit Ledger</strong><br>
          SHA-256 WORM (write-once) evidence chain
        </td>
      </tr>
    </table>

    <p style="font-size:14px;line-height:1.6;margin:0 0 8px 0;">
      If a R5,000 fixed-price pilot would be useful to ${org}, simply reply to this email and we
      will scope the 30-day programme with you directly.
    </p>

    <p style="font-size:13px;line-height:1.6;margin:0 0 24px 0;color:#333d29;">
      <strong>Reply-to:</strong> VVU Foundation · divh@venturevisionubuntu.co.za · 062 350 6594
    </p>

  </div>

  <!-- consent footer -->
  <div style="background:#f4f6f0;border-top:1px solid #dfe5d8;padding:16px 24px;">
    <p style="font-size:11px;line-height:1.6;color:#6b7560;margin:0;">
      You are receiving this message on the basis of your recorded consent or existing-customer
      relationship (POPIA s69). VVU Enterprise processes your contact details for direct
      marketing purposes only.
    </p>
    <p style="font-size:11px;line-height:1.6;color:#6b7560;margin:8px 0 0 0;">
      To opt out of future outreach, reply with the word <strong>UNSUBSCRIBE</strong> and your
      address will be removed from the programme immediately.
    </p>
    <p style="font-size:11px;line-height:1.6;color:#6b7560;margin:8px 0 0 0;">
      ©2026 VVU Foundation · Venture Vision Ubuntu · Reg. 2026/259053/07 · Trust through transparent cycles
    </p>
  </div>

</div>
</body>
</html>`;
}

// ─── Round 17 — sequence-engine email shell ─────────────────────────────────
// Wraps an AI/template personalised body in the same inbox branding as the
// Round 14 pilot email (dark strip, lime rule, screenshot, consent footer).
// INLINE STYLES ONLY — email clients strip <style> blocks. The Round 14
// buildHtml above is untouched — /send depends on it byte-for-byte.

/** Escape a personalised body: plain text → safe HTML paragraphs. */
function bodyToParagraphs(bodyText: string): string {
  return bodyText
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 8) // hard cap — AI told ≤150 words, belt-and-braces
    .map((p) => `<p style="font-size:14px;line-height:1.6;margin:0 0 16px 0;">${esc(p)}</p>`)
    .join('\n    ');
}

export interface SequenceEmailInput {
  org: string;
  contactName: string;
  subject: string;
  /** plain text, blank-line-separated paragraphs (server-validated + capped) */
  bodyText: string;
  /** true when the LLM composed the body (engine provenance strip) */
  aiGenerated: boolean;
  /** e.g. "STEP 2/3 · DAY 4" — engine provenance strip */
  stepLabel?: string;
}

/** Full sequence email HTML — personalised body inside the VVU brand shell. */
export function buildSequenceHtml(target: SequenceEmailInput, assetBase: string): string {
  const org = esc(target.org);
  const contact = esc(target.contactName);
  const paragraphs = bodyToParagraphs(target.bodyText);
  const provenance = target.stepLabel
    ? `<div style="font-size:10px;color:#6b7560;letter-spacing:1px;margin:-8px 0 16px 0;">${esc(target.stepLabel)}${target.aiGenerated ? ' · AI-PERSONALISED' : ''}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f0;font-family:Arial,Helvetica,sans-serif;color:#1a2113;">
<div style="max-width:620px;margin:0 auto;background:#ffffff;">

  <div style="background:#0b0f0a;padding:18px 24px;">
    <div style="font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:1px;">VENTURE VISION UBUNTU</div>
    <div style="font-size:11px;color:#c8ff00;letter-spacing:2px;margin-top:4px;">VVU ENTERPRISE · TRUST THROUGH TRANSPARENT CYCLES</div>
  </div>
  <div style="height:4px;background:#c8ff00;"></div>

  <div style="padding:24px;">

    <p style="font-size:14px;line-height:1.6;margin:0 0 16px 0;">Dear ${contact},</p>

    ${paragraphs}
    ${provenance}

    <div style="border:1px solid #dfe5d8;border-left:4px solid #c8ff00;padding:16px;margin:0 0 20px 0;">
      <div style="font-size:13px;font-weight:bold;color:#0b0f0a;letter-spacing:1px;margin-bottom:8px;">R5,000 FIXED-PRICE PILOT PROGRAMME</div>
      <ul style="font-size:13px;line-height:1.7;color:#333d29;margin:0;padding-left:18px;">
        <li>30-day fixed-price pilot at R5,000 (excl. VAT) — clear scope, no hidden fees</li>
        <li>City Digital Twin GIS deployment mapped to your network anchor points</li>
        <li>Edge AI monitoring: leak detection, pressure-head and thermal anomaly alerts</li>
        <li>Full licence after 3 successful verifications: R30,000/month (3 nodes)</li>
      </ul>
    </div>

    <div style="margin:0 0 8px 0;">
      <img src="${assetBase}/screenshots/spatial-dashboard.jpg" alt="VVU spatial intelligence city GIS dashboard" style="display:block;width:100%;max-width:100%;height:auto;border:1px solid #dfe5d8;">
      <div style="font-size:11px;color:#6b7560;padding:4px 0 12px 0;">City Digital Twin GIS bench — spatial intelligence projection</div>
    </div>

    <p style="font-size:13px;line-height:1.6;margin:0 0 24px 0;color:#333d29;">
      If a R5,000 fixed-price pilot would be useful to ${org}, simply reply to this email and we
      will scope the 30-day programme with you directly.
    </p>

    <p style="font-size:13px;line-height:1.6;margin:0 0 24px 0;color:#333d29;">
      <strong>Reply-to:</strong> VVU Foundation · divh@venturevisionubuntu.co.za · 062 350 6594
    </p>

  </div>

  <div style="background:#f4f6f0;border-top:1px solid #dfe5d8;padding:16px 24px;">
    <p style="font-size:11px;line-height:1.6;color:#6b7560;margin:0;">
      You are receiving this message on the basis of your recorded consent or existing-customer
      relationship (POPIA s69). VVU Enterprise processes your contact details for direct
      marketing purposes only.
    </p>
    <p style="font-size:11px;line-height:1.6;color:#6b7560;margin:8px 0 0 0;">
      To opt out of future outreach, reply with the word <strong>UNSUBSCRIBE</strong> and your
      address will be removed from the programme immediately.
    </p>
    <p style="font-size:11px;line-height:1.6;color:#6b7560;margin:8px 0 0 0;">
      ©2026 VVU Foundation · Venture Vision Ubuntu · Reg. 2026/259053/07 · Trust through transparent cycles
    </p>
  </div>

</div>
</body>
</html>`;
}

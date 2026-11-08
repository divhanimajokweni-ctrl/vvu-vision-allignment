#!/usr/bin/env bash
# Targeted specialized validation pipeline for prospective clients.
# Produces a tailored framework + comparison report package (zip) for outreach attachment.
set -euo pipefail

CLIENT_NAME="${CLIENT_NAME:-Prospective Client}"
CLIENT_DATA="${CLIENT_DATA:-}"
OUT_DIR="${OUT_DIR:-/home/runner/workspace/deliverables/targeted}"

if [ -z "$CLIENT_DATA" ] || [ ! -f "$CLIENT_DATA" ]; then
  echo "CLIENT_DATA (csv) required" >&2
  exit 1
fi

TS=$(date -u '+%Y%m%d_%H%M%S')
PKG="$OUT_DIR/${CLIENT_NAME// /_}_validation_package_$TS"
mkdir -p "$PKG"

# 1. Tailored framework
cat > "$PKG/framework.json" <<JSON
{
  "client": "$CLIENT_NAME",
  "release": "B.01",
  "generated": "$TS",
  "framework": "VVU Trust OS targeted validation",
  "metrics": ["asset_uptime_pct","throughput_units_hr","energy_kwh","defect_rate_pct"],
  "inference": "Bayesian circuit-breaker scored, fail-closed"
}
JSON

# 2. Comparison analysis
python3 - "$CLIENT_DATA" "$PKG/comparison.csv" <<'PY'
import csv,sys
src,dst=sys.argv[1],sys.argv[2]
rows=list(csv.DictReader(open(src)))
out=[]
for r in rows:
    cv=float(r['client_value']); iv=float(r['vvu_inference'])
    delta=iv-cv; pct=(delta/cv*100) if cv else 0
    conf=float(r['confidence'])
    status='PASS' if conf>=0.9 and abs(pct)<=2 else 'REVIEW'
    out.append([r['record_id'],r['source_metric'],cv,iv,round(delta,3),round(pct,3),conf,status])
with open(dst,'w',newline='') as f:
    w=csv.writer(f)
    w.writerow(['record_id','source_metric','client_value','vvu_inference','delta','delta_pct','confidence','status'])
    w.writerows(out)
PY

# 3. Report PDF
node - "$PKG" "$CLIENT_NAME" <<'NODE'
const fs=require('fs'); const PDFDocument=require('pdfkit');
const pkg=process.argv[2]; const name=process.argv[3];
const pdf=new PDFDocument({margin:50});
pdf.pipe(fs.createWriteStream(pkg+'/report.pdf'));
pdf.fontSize(20).text('Targeted Validation Report', {align:'center'});
pdf.fontSize(12).text(name+' — Pilot Beta B.01', {align:'center'});
pdf.moveDown();
pdf.fontSize(11).text('Framework: VVU Trust OS targeted validation. Comparison of client-sourced data vs VVU inference (Bayesian, fail-closed).');
pdf.moveDown();
const csv=require('fs').readFileSync(pkg+'/comparison.csv','utf8');
pdf.fontSize(9).text(csv);
pdf.end();
NODE

# 4. README
cat > "$PKG/README.md" <<MD
# Targeted Validation Package — $CLIENT_NAME

Contents:
- framework.json — tailored validation framework
- comparison.csv — client data vs VVU inference
- report.pdf — summary report

Generated $(date -u). Attach to outreach email.
MD

# 5. Zip package
cd "$OUT_DIR"
zip -qr "${PKG##*/}.zip" "${PKG##*/}"
echo "Package: $OUT_DIR/${PKG##*/}.zip"

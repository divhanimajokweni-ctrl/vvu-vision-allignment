/* VVU DOCK — a small, self-contained interop panel injected into each environment page.
   Export: environment's native data -> envelopes -> SF §8 package (download).
   Import: package file -> receivePackage() -> own interop store (IndexedDB vvu.<env>.interop). Native store untouched.
   All imported text is rendered with textContent. Imported content is never interpreted as HTML. */
(function () {
  'use strict';
  var V = window.VVU, AD = window.VVUAdapters, ST = window.VVUStore, MT = window.VVUMount;
  var ENV = window.__VVU_ENV__, NATIVE_KEY = ENV + '.vvu.v1', IDKEY = 'vvu.' + ENV + '.identity', KEYS = 'vvu.' + ENV + '.keyring';
  if (!V || !ENV) return;
  var store = ST.create(ENV), mount = null, report = [];

  function identity() {
    var id; try { id = JSON.parse(localStorage.getItem(IDKEY)); } catch (e) {}
    if (!id || !id.operator_id) {
      var op = window.prompt('VVU interop: accountable operator id for ' + ENV + ' (a person or service; anonymous export is not permitted)');
      if (!op || !op.trim()) return null;
      id = { operator_id: op.trim(), instance_id: ENV + '-' + V.uuid4().slice(0, 8) };
      try { localStorage.setItem(IDKEY, JSON.stringify(id)); } catch (e) {}
    }
    return id;
  }
  function keyring() { try { return JSON.parse(localStorage.getItem(KEYS)) || {}; } catch (e) { return {}; } }
  function benchSigner(native) { var k = native && native.keys && native.keys.signer; return k ? V.Ed25519.keypair(V.b64uDecode(k.seed)) : null; }
  function dl(name, text) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  function collect(native, id, inboxReceipts) {
    var signer = ENV === 'bench' ? benchSigner(native) : null;
    var A = AD.make(V, { environment: ENV, instance_id: id.instance_id, operator_id: id.operator_id, signer: signer }), out = [], skipped = [];
    function tryAdd(label, fn) { try { var r = fn(); (Array.isArray(r) ? r : [r]).forEach(function (x) { out.push(x); }); } catch (e) { skipped.push(label + ': ' + e.message); } }
    if (ENV === 'forge') { (native.claims || []).forEach(function (c) { tryAdd('claim ' + c.claim_id, function () { return A.forge.claim(c); }); }); (native.artefacts || []).forEach(function (a) { tryAdd('artefact ' + a.artefact_id, function () { return A.forge.legacyArtefact(a); }); }); }
    if (ENV === 'field') (native.queue || []).concat(native.delivered || []).forEach(function (o) { tryAdd('observation ' + o.observation_id, function () { return A.field.observation(o, native.gaps); }); });
    if (ENV === 'fire') (native.runs || []).forEach(function (r) { tryAdd('run ' + r.id, function () { var t = A.fire.testReport(r, native.counterexamples, native.threats); return [t.report].concat(t.counterexamples); }); });
    if (ENV === 'bench') (native.receipts || []).forEach(function (r) { tryAdd('receipt ' + r.id, function () { return A.bench.receipt(r); }); });
    if (ENV === 'press') { var byId = {}; inboxReceipts.forEach(function (r) { byId[r.id] = r; }); (native.publications || []).forEach(function (p) { tryAdd('publication ' + p.id, function () { return A.press.publication(p, byId); }); }); }
    return { envelopes: out, skipped: skipped };
  }

  function el(tag, attrs, text) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.style[k] = attrs[k]; }); if (text != null) e.textContent = text; return e; }
  var btn = el('button', { position: 'fixed', right: '12px', bottom: '12px', zIndex: 99999, padding: '8px 12px', font: '12px monospace', background: '#1b2a1b', color: '#cfe8a0', border: '1px solid #6b8f3a', borderRadius: '6px', cursor: 'pointer' }, '⇄ interop');
  var panel = el('div', { position: 'fixed', right: '12px', bottom: '52px', width: 'min(440px,92vw)', maxHeight: '70vh', overflow: 'auto', zIndex: 99999, padding: '12px', font: '12px/1.45 monospace', background: '#0f160f', color: '#d7e6c0', border: '1px solid #6b8f3a', borderRadius: '8px', display: 'none' });
  var status = el('div', { marginBottom: '8px', color: '#9ab76a' }, 'mode: starting…'), log = el('pre', { whiteSpace: 'pre-wrap', margin: '8px 0 0', wordBreak: 'break-word' }, '');
  var bExp = el('button', null, 'export package'), bImp = el('button', null, 'import package'), bKey = el('button', null, 'import keys'), bPub = el('button', null, 'export my public key'), bInb = el('button', null, 'show inbox');
  [bExp, bImp, bKey, bPub, bInb].forEach(function (b) { b.style.cssText = 'margin:0 6px 6px 0;padding:5px 8px;font:12px monospace;cursor:pointer'; });
  var file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.style.display = 'none';
  [status, bExp, bImp, bKey, bPub, bInb, file, log].forEach(function (n) { panel.appendChild(n); });
  btn.onclick = function () { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
  document.body.appendChild(btn); document.body.appendChild(panel);
  function say(lines) { log.textContent = lines.join('\n'); }
  var fileMode = null; bImp.onclick = function () { fileMode = 'pkg'; file.click(); }; bKey.onclick = function () { fileMode = 'keys'; file.click(); };

  bExp.onclick = function () {
    var id = identity(); if (!id) return say(['export cancelled: no accountable operator id']);
    var native; try { native = JSON.parse(localStorage.getItem(NATIVE_KEY)); } catch (e) {} if (!native) return say(['nothing to export: no ' + NATIVE_KEY + ' in this origin']);
    store.open().then(function () { return store.list('artefacts'); }).then(function (rows) {
      var c = collect(native, id, rows.filter(function (r) { return r.value.artefact_type === 'verification_receipt'; }).map(function (r) { return AD.make(V, { environment: ENV, instance_id: id.instance_id, operator_id: id.operator_id }).press.receiptFromEnvelope(r.value); }));
      if (!c.envelopes.length) return say(['0 artefacts exportable'].concat(c.skipped));
      var pkg = V.buildPackage(c.envelopes, { environment: ENV, instance_id: id.instance_id, operator_id: id.operator_id });
      dl('vvu-' + ENV + '-package-' + pkg.package_digest.slice(7, 15) + '.json', JSON.stringify(pkg, null, 2)); if (mount) mount.offer(pkg);
      say(['exported ' + c.envelopes.length + ' artefact(s)', 'package_digest ' + pkg.package_digest, 'signed: ' + c.envelopes.filter(function (e) { return e.integrity.signature; }).length + ' of ' + c.envelopes.length].concat(c.skipped.length ? ['not exportable (' + c.skipped.length + '):'].concat(c.skipped) : []));
    });
  };
  bPub.onclick = function () {
    var native; try { native = JSON.parse(localStorage.getItem(NATIVE_KEY)); } catch (e) {} var id = identity(), kp = benchSigner(native);
    if (!id || !kp) return say(['no signing key in this environment: its artefacts export unsigned (valid, but carries no producer authentication)']);
    var o = {}; o[id.operator_id] = V.b64uEncode(kp.publicKey); dl('vvu-' + ENV + '-keys.json', JSON.stringify(o, null, 2)); say(['public key exported for ' + id.operator_id]);
  };
  file.onchange = function () {
    var f = file.files[0]; file.value = ''; if (!f) return;
    f.text().then(function (txt) {
      var data; try { data = JSON.parse(txt); } catch (e) { return say(['not JSON']); }
      if (fileMode === 'keys') { var kr = keyring(), n = 0; Object.keys(data).forEach(function (k) { if (typeof data[k] === 'string' && /^[A-Za-z0-9_-]{43}$/.test(data[k])) { kr[k] = data[k]; n++; } }); localStorage.setItem(KEYS, JSON.stringify(kr)); return say([n + ' key(s) added to the local keyring']); }
      var id = identity(); if (!id) return say(['import cancelled: no operator id']);
      store.open().then(function () { return store.knownDigests(); }).then(function (known) {
        var kr = keyring(), ctx = { self: { environment: ENV, instance_id: id.instance_id, operator_id: id.operator_id }, supportedVersions: ['1.0.0'], knownDigests: known, resolveKey: function (pb) { return kr[pb.operator_id] ? V.b64uDecode(kr[pb.operator_id]) : null; } };
        var r = V.receivePackage(data, ctx);
        if (!r.ok) return say(['PACKAGE REJECTED ' + r.package.code].concat(r.package.errors));
        return Promise.all(r.results.map(function (x, i) { return store.commitReceipt(x, data.artefacts[i]); })).then(function () {
          say(['package from ' + data.exported_by.environment + ' · ' + r.results.length + ' artefact(s)', 'nothing here is verified by arriving; INTEGRITY_VALID means the bytes match their digest' + '', ''].concat(r.results.map(function (x) { return (x.finalStatus + (x.reason_code ? ' ' + x.reason_code : '')).padEnd(34) + (x.artefact_id || 'unidentified') + (x.duplicate ? ' (already held)' : '') + (x.limitations.length ? '\n    ' + x.limitations.join('\n    ') : ''); })));
        });
      });
    });
  };
  bInb.onclick = function () {
    store.open().then(function () { return Promise.all([store.list('artefacts'), store.list('rejections')]); }).then(function (a) {
      say(['backend: ' + store.backend(), 'held artefacts: ' + a[0].length, 'rejections: ' + a[1].length, ''].concat(a[0].map(function (r) { return r.value.artefact_type.padEnd(22) + r.key + '\n    from ' + r.value.produced_by.environment + ' · exported ' + r.value.status + (r.value.content && r.value.content.outcome ? ' · outcome ' + r.value.content.outcome : '') + (r.value.content && r.value.content.summary ? ' · result ' + r.value.content.summary.result : ''); })));
    });
  };
  store.open().then(function () {
    mount = MT.attach({ env: ENV, instance_id: (identity() || { instance_id: ENV + '-anon' }).instance_id });
    return mount.connect(600);
  }).then(function (m) { status.textContent = 'mode: ' + m + ' · store: ' + store.backend() + ' · env: ' + ENV; });
})();

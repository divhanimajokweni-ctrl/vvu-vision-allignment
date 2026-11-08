/* VVU SUB-WORKER — verifies packages off the UI thread. Same core, same answers as the page.
   Spawn:  new Worker('vvu-worker.js')   (expects vvu-core.js beside it)
   In:  {id, op:'receivePackage', package, supportedVersions, keys:{operator_id:b64u_pubkey}, self}
        {id, op:'verifyPackage', package}
        {id, op:'digest', envelope}
   Out: {id, ok, result} | {id, ok:false, error}.  It never touches storage and never assigns VERIFIED. */
importScripts('vvu-core.js');
self.onmessage = function (ev) {
  var m = ev.data || {}, V = self.VVU;
  try {
    if (m.op === 'verifyPackage') return self.postMessage({ id: m.id, ok: true, result: V.verifyPackage(m.package) });
    if (m.op === 'digest') return self.postMessage({ id: m.id, ok: true, result: V.digestOf(m.envelope) });
    if (m.op === 'receivePackage') {
      var keys = m.keys || {};
      var r = V.receivePackage(m.package, { self: m.self, supportedVersions: m.supportedVersions || ['1.0.0'], knownDigests: m.knownDigests || {},
        resolveKey: function (pb) { var k = keys[pb.operator_id]; return k ? V.b64uDecode(k) : null; } });
      return self.postMessage({ id: m.id, ok: true, result: { ok: r.ok, package: r.package, results: r.results.map(function (x) { return { artefact_id: x.artefact_id, finalStatus: x.finalStatus, reason_code: x.reason_code, limitations: x.limitations, steps: x.steps, transitions: x.transitions, artefact: x.artefact }; }) } });
    }
    self.postMessage({ id: m.id, ok: false, error: 'unknown op ' + m.op });
  } catch (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); }
};

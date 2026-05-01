(function () {
  const results = [];

  function formatValue(value) {
    if (typeof value === 'string') return '"' + value + '"';
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }

  function logResult(status, name, details) {
    results.push({ status, name, details: details || '' });
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error((message || 'Valore inatteso') + ' | atteso=' + formatValue(expected) + ' ricevuto=' + formatValue(actual));
    }
  }

  function assertDeepEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error((message || 'Valore inatteso') + ' | atteso=' + e + ' ricevuto=' + a);
    }
  }

  function assertTrue(actual, message) {
    if (actual !== true) {
      throw new Error((message || 'Valore atteso true') + ' | ricevuto=' + formatValue(actual));
    }
  }

  function assertFalse(actual, message) {
    if (actual !== false) {
      throw new Error((message || 'Valore atteso false') + ' | ricevuto=' + formatValue(actual));
    }
  }


  function assertApprox(actual, expected, epsilon, message) {
    const tol = (typeof epsilon === 'number' && epsilon >= 0) ? epsilon : 0.000001;
    if (Math.abs(actual - expected) > tol) {
      throw new Error((message || 'Valore inatteso') + ' | atteso≈' + formatValue(expected) + ' ricevuto=' + formatValue(actual) + ' tolleranza=' + tol);
    }
  }

  function assertIncludes(actual, expected, message) {
    const hay = String(actual);
    const needle = String(expected);
    if (!hay.includes(needle)) {
      throw new Error((message || 'Contenuto mancante') + ' | atteso frammento=' + formatValue(expected));
    }
  }

  function assertMatch(actual, regex, message) {
    const hay = String(actual);
    const re = regex instanceof RegExp ? regex : new RegExp(String(regex));
    if (!re.test(hay)) {
      throw new Error((message || 'Pattern non trovato') + ' | pattern=' + String(re));
    }
  }

  function test(name, fn) {
    try {
      fn();
      logResult('PASS', name);
    } catch (err) {
      logResult('FAIL', name, err && err.message ? err.message : String(err));
    }
  }

  function renderResults(targetId) {
    const target = document.getElementById(targetId || 'test-results');
    if (!target) return;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const summary = document.createElement('div');
    summary.className = 'mb-3';
    summary.innerHTML = '<strong>Test eseguiti:</strong> ' + results.length + ' — <span style="color:#198754">PASS ' + passed + '</span> / <span style="color:#dc3545">FAIL ' + failed + '</span>';
    target.appendChild(summary);

    const list = document.createElement('div');
    results.forEach(function (result) {
      const item = document.createElement('div');
      item.style.border = '1px solid ' + (result.status === 'PASS' ? '#198754' : '#dc3545');
      item.style.borderRadius = '8px';
      item.style.padding = '10px 12px';
      item.style.marginBottom = '10px';
      item.style.background = result.status === 'PASS' ? '#eefaf2' : '#fff1f2';
      item.innerHTML = '<div><strong>' + result.status + '</strong> — ' + result.name + '</div>' + (result.details ? '<div style="margin-top:6px; white-space:pre-wrap; font-family:monospace;">' + result.details + '</div>' : '');
      list.appendChild(item);
    });
    target.appendChild(list);

    const statusEl = document.getElementById('test-status');
    if (statusEl) {
      statusEl.textContent = failed ? 'KO' : 'OK';
      statusEl.style.color = failed ? '#dc3545' : '#198754';
    }
  }

  function run(targetId) {
    renderResults(targetId || (document.getElementById('test-results') ? 'test-results' : 'test-output'));
  }

  window.TestHarness = {
    test,
    assertEqual,
    assertDeepEqual,
    assertTrue,
    assertFalse,
    assertApprox,
    assertIncludes,
    assertMatch,
    renderResults,
    run,
    getResults: function () { return results.slice(); }
  };
})();

import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin } from '../work/tests/request-origin.js';
test('允许同源与显式HTTPS公网来源；拒绝任意外站和伪造转发头', () => {
  const origin = 'https://game.example.com';
  const req = (value, extra = {}) =>
    new Request('http://127.0.0.1:3100/api/rooms', {
      headers: { Origin: value, ...extra },
    });
  assert.equal(allowedOrigin(req('http://127.0.0.1:3100')), true);
  assert.equal(allowedOrigin(req(origin), origin), true);
  assert.equal(allowedOrigin(req('https://evil.example'), origin), false);
  assert.equal(allowedOrigin(req('null'), origin), false);
  assert.equal(allowedOrigin(req(origin)), false);
  assert.equal(
    allowedOrigin(
      req('https://evil.example', {
        'X-Forwarded-Host': 'evil.example',
        'X-Forwarded-Proto': 'https',
      }),
      origin,
    ),
    false,
  );
});

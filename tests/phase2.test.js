import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';

let server,
  api,
  masterDataService,
  verificationService,
  buildVerificationFormData,
  getProviderVerification,
  accountNotificationService,
  pusherConfiguration,
  normalizeAuthUser;
before(async () => {
  globalThis.window = new EventTarget();
  window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  server = await createServer({ cacheDir: `node_modules/.vite-tests/phase2-${process.pid}`, server: { middlewareMode: true }, appType: 'custom' });
  ({ api } = await server.ssrLoadModule('/src/services/api.js'));
  ({ masterDataService } = await server.ssrLoadModule('/src/services/masterDataService.js'));
  ({ verificationService, buildVerificationFormData } = await server.ssrLoadModule(
    '/src/services/verificationService.js'
  ));
  ({ getProviderVerification } = await server.ssrLoadModule(
    '/src/services/providerVerificationService.js'
  ));
  ({ accountNotificationService } = await server.ssrLoadModule(
    '/src/services/accountNotificationService.js'
  ));
  ({ pusherConfiguration } = await server.ssrLoadModule('/src/services/pusherService.js'));
  ({ normalizeAuthUser } = await server.ssrLoadModule('/src/services/authService.js'));
});
after(async () => {
  await server?.close();
  delete globalThis.window;
});
const respond = (data, verify = () => {}) => {
  api.defaults.adapter = async (config) => {
    verify(config);
    return { data, config, status: 200, statusText: 'OK', headers: {} };
  };
};

test('verification submission uploads multipart files and metadata, without client ownership or approval fields', async () => {
  const file = new Blob(['test'], { type: 'application/pdf' });
  const documents = [
    {
      document_type: 'degree',
      document_name: 'Bằng sư phạm',
      issuing_authority: 'Trường A',
      issued_year: '2020',
      file,
      status: 'approved',
      teacher_user_id: 999,
    },
  ];
  const form = buildVerificationFormData(documents);
  assert.equal(form.get('documents[0][document_name]'), 'Bằng sư phạm');
  assert.ok(form.get('documents[0][file]') instanceof Blob);
  assert.equal(form.has('documents[0][status]'), false);
  assert.equal(form.has('teacher_user_id'), false);
  respond({ request: { id: 1, status: 'pending' } }, (config) => {
    assert.equal(config.url, '/verifications');
    assert.equal(config.method, 'post');
    assert.ok(config.data instanceof FormData);
  });
  assert.equal((await verificationService.submit(documents)).request.status, 'pending');
});

test('verification list supports pagination and file preview uses authenticated blob responses', async () => {
  respond({ requests: { data: [], current_page: 2 } }, (config) => {
    assert.equal(config.url, '/verifications');
    assert.equal(config.params.page, 2);
  });
  assert.equal((await verificationService.list(2)).requests.current_page, 2);
  const blob = new Blob(['private document'], { type: 'application/pdf' });
  respond(blob, (config) => {
    assert.equal(config.url, '/verifications/documents/7');
    assert.equal(config.responseType, 'blob');
  });
  assert.equal(await verificationService.document(7), blob);
});

test('master data services use public backend endpoints and preserve database ordering', async () => {
  for (const [url, read] of [
    ['/subjects', () => masterDataService.subjects()],
    ['/education-levels', () => masterDataService.levels()],
    ['/banners', () => masterDataService.banners()],
    ['/administrative-areas/provinces', () => masterDataService.provinces()],
    ['/administrative-areas/districts/1', () => masterDataService.districts(1)],
    ['/administrative-areas/wards/2', () => masterDataService.wards(2)],
    ['/providers/7', () => masterDataService.provider(7)],
  ]) {
    respond({ data: [{ id: 2 }, { id: 1 }] }, (config) => assert.equal(config.url, url));
    assert.deepEqual(await read(), [{ id: 2 }, { id: 1 }]);
  }
});

test('visible provider badges batch different user IDs and share repeated callers', async () => {
  let calls = 0;
  respond(
    {
      data: [
        { user_id: 1, role: 'teacher', verification_status: 'verified', verified_at: '2026-10-19' },
      ],
    },
    (config) => {
      calls++;
      assert.equal(config.url, '/provider-verifications');
      assert.deepEqual(config.params.user_ids, [1, 2]);
    }
  );
  const [first, repeated, missing] = await Promise.all([
    getProviderVerification(1),
    getProviderVerification('1'),
    getProviderVerification(2),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(first, repeated);
  assert.equal(first.verification_status, 'verified');
  assert.equal(missing, null);
});

test('sample provider identifiers cannot be turned into a verified backend badge', async () => {
  let calls = 0;
  respond({ data: [] }, () => calls++);
  for (const id of ['mai-anh', 'teacher-1', '', null, 0, -1])
    assert.equal(await getProviderVerification(id), null);
  assert.equal(calls, 0);
});

test('badge lookups respect the backend batch limit and remain retryable after an API error', async () => {
  let calls = 0;
  respond({ data: [] }, (config) => {
    calls++;
    assert.ok(config.params.user_ids.length <= 100);
  });
  await Promise.all(Array.from({ length: 101 }, (_, i) => getProviderVerification(i + 10)));
  assert.equal(calls, 2);
  api.defaults.adapter = async () => {
    throw new Error('Temporary failure');
  };
  await assert.rejects(getProviderVerification(1), /Temporary failure/);
  respond({
    data: [{ user_id: 1, role: 'teacher', verification_status: 'pending', verified_at: null }],
  });
  assert.equal((await getProviderVerification(1)).verification_status, 'pending');
});

test('server notifications can be read individually or all at once using backend endpoints', async () => {
  respond({ data: [{ id: 'server-8', server_id: 8, isRead: false }] }, (config) =>
    assert.equal(config.url, '/notifications')
  );
  assert.equal((await accountNotificationService.list())[0].server_id, 8);
  respond({ message: 'OK' }, (config) => {
    assert.equal(config.url, '/notifications/8/read');
    assert.equal(config.method, 'post');
  });
  await accountNotificationService.read(8);
  respond({ message: 'OK' }, (config) => {
    assert.equal(config.url, '/notifications/read-all');
    assert.equal(config.method, 'post');
  });
  await accountNotificationService.readAll();
});

test('Pusher uses a private-channel authentication endpoint and never needs the server secret in React', () => {
  const config = pusherConfiguration();
  assert.match(config.authEndpoint, /\/broadcasting\/auth$/);
  assert.equal(config.cluster, 'ap1');
  assert.equal('secret' in config, false);
});

test('normalized verification status comes from backend profiles rather than legacy local flags', () => {
  const teacher = normalizeAuthUser({
    id: 1,
    role: 'teacher',
    teacher_profile: { verification_status: 'verified', verified_at: '2026-10-19' },
  });
  assert.equal(teacher.verificationStatus, 'verified');
  assert.equal(teacher.verifiedAt, '2026-10-19');
  const center = normalizeAuthUser({
    id: 2,
    role: 'center',
    licenseVerificationStatus: 'verified',
    center: { verification_status: 'pending' },
  });
  assert.equal(center.licenseVerificationStatus, 'pending');
  assert.equal(center.verifiedAt, null);
});

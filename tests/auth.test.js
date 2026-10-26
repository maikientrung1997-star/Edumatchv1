import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

let server;
let authService;
let api;
let registration;
let profileService;
let normalizeAuthUser;
let validateNewPassword;
const values = new Map();

before(async () => {
  globalThis.window = new EventTarget();
  window.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  server = await createServer({ cacheDir: `node_modules/.vite-tests/auth-${process.pid}`, server: { middlewareMode: true }, appType: 'custom' });
  ({ api } = await server.ssrLoadModule('/src/services/api.js'));
  ({ authService, normalizeAuthUser } = await server.ssrLoadModule('/src/services/authService.js'));
  ({ profileService } = await server.ssrLoadModule('/src/services/profileService.js'));
  ({ validateNewPassword } = await server.ssrLoadModule('/src/utils/passwordValidation.js'));
  registration = await server.ssrLoadModule('/src/pages/Register/registerData.js');
});

after(async () => {
  await server?.close();
  delete globalThis.window;
});

beforeEach(() => values.clear());

const respond = (data, verify = () => {}) => {
  api.defaults.adapter = async (config) => {
    verify(config);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
};

const reject = (status, data = {}) => {
  api.defaults.adapter = async (config) => {
    throw { response: status ? { status, data } : undefined, config, message: 'Request failed' };
  };
};

test('registration sends confirmation, normalized email and snake_case birth date', () => {
  const payload = registration.buildRegistrationPayload({
    ...registration.initialForm,
    name: ' Nguyễn Văn A ', email: ' STUDENT@GMAIL.COM ', phone: '098 123.4567',
    dateOfBirth: '2002-05-15', password: 'Admin@123', confirmPassword: 'Admin@123',
  }, 'student');
  assert.equal(payload.name, 'Nguyễn Văn A');
  assert.equal(payload.email, 'student@gmail.com');
  assert.equal(payload.phone, '0981234567');
  assert.equal(payload.password_confirmation, 'Admin@123');
  assert.equal(payload.date_of_birth, '2002-05-15');
  assert.equal(payload.role, 'student');
});

test('client validation rejects short password, future date and oversized name/email', () => {
  const form = {
    ...registration.initialForm, name: 'Valid name', email: 'student@gmail.com', phone: '0981234567',
    dateOfBirth: '2002-05-15', password: 'Admin@123', confirmPassword: 'Admin@123',
  };
  assert.deepEqual(registration.validateRegistration(form, 'student'), {});
  const errors = registration.validateRegistration({
    ...form, name: 'a'.repeat(151), email: `${'a'.repeat(190)}@gmail.com`, password: '123456', dateOfBirth: '2999-01-01',
  }, 'student');
  for (const field of ['name', 'email', 'password', 'dateOfBirth']) assert.ok(errors[field], field);
});

test('Laravel field errors map to the corresponding form fields', () => {
  assert.deepEqual(registration.mapRegistrationErrors({
    email: ['Email trùng'], phone: ['Số điện thoại trùng'], date_of_birth: ['Ngày sinh sai'],
    password_confirmation: ['Chưa xác nhận'], full_name: ['Tên sai'],
  }), { email: 'Email trùng', phone: 'Số điện thoại trùng', dateOfBirth: 'Ngày sinh sai', confirmPassword: 'Chưa xác nhận', name: 'Tên sai' });
});

test('real login accepts access_token and stores returned user/profile', async () => {
  respond({ access_token: '1|real-token', user: { id: 1, name: 'Student', role: 'student', student_profile: { date_of_birth: '2002-05-15T00:00:00.000000Z' } } }, (config) => {
    assert.equal(config.url, '/auth/login');
    assert.equal(JSON.parse(config.data).phone, '0981234567');
  });
  const response = await authService.login({ phone: '0981234567', password: 'Admin@123' });
  assert.equal(response.token, '1|real-token');
  assert.equal(JSON.parse(values.get('access_token')), '1|real-token');
  assert.equal(JSON.parse(values.get('user_info')).dob, '2002-05-15');
});

test('registration persists the server session before welcome navigation', async () => {
  respond({ token: '2|registered-token', user: { id: 2, role: 'student' } });
  const response = await authService.register({ name: 'Student' });
  assert.equal(response.user.id, 2);
  assert.equal(JSON.parse(values.get('access_token')), '2|registered-token');
});

test('Google exchanges credential nonce and selected role and persists only the EduMatch session', async () => {
  respond({ token: '4|google-session', user: { id: 4, role: 'teacher', avatar_url: 'https://lh3.googleusercontent.com/me.jpg' }, is_new_user: true }, (config) => {
    assert.equal(config.url, '/auth/google');
    assert.deepEqual(JSON.parse(config.data), { credential: 'signed-google-jwt', nonce: 'single-use-nonce', role: 'teacher' });
  });
  const result = await authService.googleLogin({ credential: 'signed-google-jwt', nonce: 'single-use-nonce', role: 'teacher' });
  assert.equal(result.is_new_user, true);
  assert.equal(result.user.avatar, 'https://lh3.googleusercontent.com/me.jpg');
  assert.equal(JSON.parse(values.get('access_token')), '4|google-session');
  assert.equal([...values.values()].some((value) => value.includes('signed-google-jwt')), false);
});

test('invalid Google credential does not clear another current session or create a fake one', async () => {
  reject(401, { message: 'Google credential rejected' });
  await assert.rejects(authService.googleLogin({ credential: 'invalid' }));
  assert.equal(values.size, 0);
  values.set('access_token', JSON.stringify('existing-session'));
  values.set('user_info', JSON.stringify({ id: 9 }));
  await assert.rejects(authService.googleLogin({ credential: 'invalid' }));
  assert.equal(JSON.parse(values.get('access_token')), 'existing-session');
});

test('401, 403, 422 and network errors are propagated without a mock session', async () => {
  for (const status of [401, 403, 422, null]) {
    reject(status, { errors: { phone: ['Trùng'] } });
    await assert.rejects(authService.login({ phone: '0981234567', password: 'wrong' }));
    await assert.rejects(authService.register({}));
    assert.equal(values.size, 0);
  }
});

test('malformed successful response cannot fabricate an authenticated user', async () => {
  respond({ user: { id: 1 } });
  await assert.rejects(authService.login({}), /Phản hồi xác thực/);
  assert.equal(values.size, 0);
});

test('profile restoration calls the API with bearer token and never returns a cached demo user', async () => {
  values.set('access_token', JSON.stringify('3|saved-token'));
  values.set('user_info', JSON.stringify({ id: 'demo' }));
  respond({ user: { id: 3, role: 'student' } }, (config) => {
    assert.equal(config.url, '/auth/me');
    assert.equal(config.headers.Authorization, 'Bearer 3|saved-token');
  });
  assert.equal((await authService.getProfile()).user.id, 3);
  reject(401);
  await assert.rejects(authService.getProfile());
  assert.equal(values.has('access_token'), false);
  assert.equal(values.has('user_info'), false);
});

test('logout clears local authentication even if the API is unavailable', async () => {
  values.set('access_token', JSON.stringify('4|saved-token'));
  values.set('user_info', JSON.stringify({ id: 4 }));
  reject(null);
  await assert.rejects(authService.logout());
  assert.equal(values.size, 0);
});

test('teacher and center forms send professional and legal fields in backend format', () => {
  const teacher = registration.buildRegistrationPayload({ ...registration.initialForm,
    name: 'Teacher', email: 'teacher@gmail.com', phone: '0981234567', dateOfBirth: '1990-05-15',
    password: 'Password@123', confirmPassword: 'Password@123', qualification: 'IELTS 8.0',
    experience: '5 năm giảng dạy', biography: 'Dạy học bằng thực hành', isPhonePublic: true,
  }, 'teacher');
  assert.equal(teacher.headline, 'IELTS 8.0');
  assert.equal(teacher.experience_years, 5);
  assert.equal(teacher.show_phone, true);
  assert.equal(teacher.bio, 'Dạy học bằng thực hành');
  const center = registration.buildRegistrationPayload({ ...registration.initialForm,
    centerName: 'Trung tâm Ánh Dương', email: ' CENTER@GMAIL.COM ', phone: '0981234568', foundedYear: '2018',
    password: 'Password@123', confirmPassword: 'Password@123', centerDescription: 'Trung tâm đào tạo',
  }, 'center');
  assert.equal(center.name, 'Trung tâm Ánh Dương');
  assert.equal(center.email, 'center@gmail.com');
  assert.equal(center.founded_year, 2018);
  assert.equal(center.bio, undefined);
  assert.equal(center.center_description, 'Trung tâm đào tạo');
  assert.equal(center.centerProfile.description, 'Trung tâm đào tạo');
  assert.equal(center.password_confirmation, 'Password@123');
  assert.equal(center.isPhonePublic, undefined);
});

test('center capability profiles are not limited by the generic 5,000-character bio field', () => {
  const centerDescription = 'Nội dung hồ sơ năng lực '.repeat(300);
  const form = {
    ...registration.initialForm,
    centerName: 'Trung tâm Ánh Dương',
    email: 'center@gmail.com',
    phone: '0981234568',
    password: 'Password@123',
    confirmPassword: 'Password@123',
    foundedYear: '2018',
    teachingField: 'Ngoại ngữ',
    centerDescription,
  };
  assert.equal(registration.validateRegistration(form, 'center').centerDescription, undefined);
  const payload = registration.buildRegistrationPayload(form, 'center');
  assert.equal(payload.bio, undefined);
  assert.equal(payload.centerProfile.description, centerDescription.trim());
});

test('all registration roles require a valid email, including centers', () => {
  for (const role of ['student', 'teacher', 'center']) {
    assert.ok(registration.validateRegistration({ ...registration.initialForm, email: '' }, role).email);
    assert.ok(registration.validateRegistration({ ...registration.initialForm, email: 'invalid' }, role).email);
    assert.equal(registration.validateRegistration({ ...registration.initialForm, email: 'valid@gmail.com' }, role).email, undefined);
  }
  assert.ok(registration.centerAccountFields.some((field) => field.name === 'email'));
});

test('sending a registration OTP never creates a local authenticated session', async () => {
  respond({ message: 'Đã gửi OTP', email: 'student@gmail.com', expires_in: 600, resend_after: 60 }, (config) => {
    assert.equal(config.url, '/auth/register/send-otp');
    assert.equal(config.method, 'post');
    assert.deepEqual(JSON.parse(config.data), { name: 'Student', email: 'student@gmail.com', phone: '0981234567' });
  });
  const response = await authService.sendRegistrationOtp({ name: 'Student', email: 'student@gmail.com', phone: '0981234567' });
  assert.equal(response.resend_after, 60);
  assert.equal(values.size, 0);
});

test('registration submits the OTP and failed verification cannot store a session', async () => {
  reject(422, { errors: { otp: ['Mã không chính xác'] } });
  await assert.rejects(authService.register({ otp: '000000' }));
  assert.equal(values.size, 0);
  respond({ token: 'verified-session', user: { id: 7, email_verified_at: '2026-10-18T10:00:00Z' } }, (config) => {
    assert.equal(config.url, '/auth/register');
    assert.equal(JSON.parse(config.data).otp, '123456');
  });
  const response = await authService.register({ ...registration.buildRegistrationPayload({
    ...registration.initialForm, name: 'Student', email: 'student@gmail.com', phone: '0981234567',
  }, 'student'), otp: '123456' });
  assert.ok(response.user.email_verified_at);
  assert.equal(JSON.parse(values.get('access_token')), 'verified-session');
});

test('professional registration maps field errors and validates years', () => {
  assert.deepEqual(registration.mapRegistrationErrors({ founded_year: ['Năm sai'], name: ['Tên sai'], center_description: ['Mô tả sai'] }, 'center'), {
    foundedYear: 'Năm sai', centerName: 'Tên sai', centerDescription: 'Mô tả sai',
  });
  assert.deepEqual(registration.mapRegistrationErrors({ headline: ['Quá dài'], experience_years: ['Năm sai'], bio: ['Mô tả sai'] }, 'teacher'), {
    qualification: 'Quá dài', experience: 'Năm sai', biography: 'Mô tả sai',
  });
  assert.ok(registration.validateRegistration({ ...registration.initialForm, foundedYear: '2999' }, 'center').foundedYear);
  assert.ok(registration.validateRegistration({ ...registration.initialForm, experience: '61 năm' }, 'teacher').experience);
});

test('profiles are restored from server data for all roles', () => {
  const teacher = normalizeAuthUser({ id: 1, role: 'teacher', name: 'Teacher', avatar_url: 'http://localhost/storage/avatars/test.png',
    teacher_profile: { headline: 'IELTS 8.0', bio: 'Giới thiệu', show_phone: true, experience_years: 6, date_of_birth: '1990-05-15T00:00:00Z' },
  });
  assert.equal(teacher.qualifications, 'IELTS 8.0');
  assert.equal(teacher.experience, '6 năm kinh nghiệm');
  assert.equal(teacher.isPhonePublic, true);
  assert.equal(teacher.dob, '1990-05-15');
  assert.ok(teacher.avatar.endsWith('test.png'));
  const center = normalizeAuthUser({ id: 2, role: 'center', name: 'Representative', center: { name: 'Trung tâm', founded_year: 2018, bio: 'Đào tạo' } });
  assert.equal(center.name, 'Trung tâm');
  assert.equal(center.foundedYear, '2018');
});

test('forgot/reset/change-password use real API without fabricating a session', async () => {
  for (const [path, invoke] of [
    ['/auth/forgot-password', () => authService.forgotPassword('student@gmail.com')],
    ['/auth/reset-password', () => authService.resetPassword({ identifier: 'student@gmail.com', otp: '123456' })],
    ['/auth/change-password', () => authService.changePassword({ current_password: 'old', password: 'new' })],
  ]) {
    respond({ message: 'OK' }, (config) => assert.equal(config.url, path));
    assert.equal((await invoke()).message, 'OK');
    assert.equal(values.size, 0);
  }
  reject(422, { errors: { otp: ['Mã sai'] } });
  await assert.rejects(authService.resetPassword({}));
});

test('profile update, avatar and area services use backend endpoints', async () => {
  respond({ user: { id: 1, name: 'Updated', role: 'student', student_profile: { bio: 'IELTS' } } }, (config) => {
    assert.equal(config.url, '/profile');
    assert.equal(config.method, 'put');
  });
  assert.equal((await profileService.update({ name: 'Updated' })).user.bio, 'IELTS');
  respond({ data: [{ id: 1, name: 'Hà Nội' }] }, (config) => {
    assert.equal(config.url, '/administrative-areas');
    assert.equal(config.params.level, 'province');
  });
  assert.equal((await profileService.areas({ level: 'province' }))[0].name, 'Hà Nội');
  respond({ user: { id: 1, avatar_url: 'http://localhost/storage/avatars/new.png' } }, (config) => {
    assert.equal(config.url, '/profile/avatar');
    assert.ok(config.data instanceof FormData);
    assert.ok(config.data.has('avatar'));
  });
  assert.ok((await profileService.uploadAvatar(new Blob(['test'], { type: 'image/png' }))).user.avatar.endsWith('new.png'));
});

test('new password validation catches weak and mismatching confirmation', () => {
  assert.deepEqual(validateNewPassword({ password: 'ValidPassword@123', password_confirmation: 'ValidPassword@123' }), {});
  assert.ok(validateNewPassword({ password: '123', password_confirmation: '456' }).password);
  assert.ok(validateNewPassword({ password: 'ValidPassword@123', password_confirmation: 'wrong' }).password_confirmation);
});

// Keep requests pending so concurrent callers reproduce the effect replay in StrictMode.
const holdResponses = (data) => {
  const requests = [];
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  api.defaults.adapter = async (config) => {
    requests.push(config);
    await pending;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  return { requests, release };
};

test('concurrent auth, profile and province reads each send only one HTTP request', async () => {
  values.set('access_token', JSON.stringify('shared-session'));
  for (const [read, data] of [
    [() => authService.getProfile(), { user: { id: 1, role: 'student' } }],
    [() => profileService.get(), { user: { id: 1, role: 'student' } }],
    [() => profileService.areas({ level: 'province' }), { data: [{ id: 1 }] }],
  ]) {
    const { requests, release } = holdResponses(data);
    const reads = [read(), read()];
    try {
      await new Promise(setImmediate);
      assert.equal(requests.length, 1);
    } finally {
      release();
      const results = await Promise.all(reads);
      assert.deepEqual(results[0], results[1]);
    }
  }
});

test('area reads share equal parameters but keep different parents and levels separate', async () => {
  const { requests, release } = holdResponses({ data: [] });
  const reads = [
    profileService.areas({ parent_id: 1, level: 'ward' }),
    profileService.areas({ level: 'ward', parent_id: 1 }),
    profileService.areas({ parent_id: 2, level: 'ward' }),
    profileService.areas({ parent_id: 1, level: 'district' }),
  ];
  try {
    await new Promise(setImmediate);
    assert.equal(requests.length, 3);
  } finally {
    release();
    await Promise.all(reads);
  }
});

test('pending profile reads cannot be shared across different login tokens', async () => {
  const { requests, release } = holdResponses({ user: { id: 1 } });
  values.set('access_token', JSON.stringify('session-a'));
  const first = profileService.get();
  await new Promise(setImmediate);
  values.set('access_token', JSON.stringify('session-b'));
  const second = profileService.get();
  try {
    await new Promise(setImmediate);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests.map((request) => request.headers.Authorization), [
      'Bearer session-a', 'Bearer session-b',
    ]);
  } finally {
    release();
    await Promise.all([first, second]);
  }
});

test('completed profile reads are not cached, including after a profile update', async () => {
  let reads = 0;
  let name = 'Before';
  api.defaults.adapter = async (config) => {
    if (config.method === 'put') name = JSON.parse(config.data).name;
    else reads += 1;
    return { data: { user: { id: 1, name } }, status: 200, statusText: 'OK', headers: {}, config };
  };
  assert.equal((await profileService.get()).user.name, 'Before');
  assert.equal((await profileService.get()).user.name, 'Before');
  await profileService.update({ name: 'After' });
  assert.equal((await profileService.get()).user.name, 'After');
  assert.equal(reads, 3);
});

test('a failed shared request is removed so a subsequent read can retry', async () => {
  let requests = 0;
  const failure = new Error('Temporary network failure');
  api.defaults.adapter = async () => { requests += 1; throw failure; };
  const results = await Promise.allSettled([profileService.get(), profileService.get()]);
  assert.equal(requests, 1);
  assert.ok(results.every((result) => result.status === 'rejected' && result.reason === failure));
  respond({ user: { id: 1, name: 'Recovered' } });
  assert.equal((await profileService.get()).user.name, 'Recovered');
});

test('write operations remain independent requests', async () => {
  const { requests, release } = holdResponses({ user: { id: 1 } });
  const writes = [profileService.update({ name: 'First' }), profileService.update({ name: 'Second' })];
  try {
    await new Promise(setImmediate);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests.map((request) => JSON.parse(request.data).name), ['First', 'Second']);
  } finally {
    release();
    await Promise.all(writes);
  }
});

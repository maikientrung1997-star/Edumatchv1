import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { getProviderVerification } from '@/services/providerVerificationService';
import './verifiedBadge.css';

export function VerifiedBadge({ userId, provider = null, className = '' }) {
  const [record, setRecord] = useState(null);
  useEffect(() => {
    let active = true;
    let version = 0;
    const load = async () => {
      const current = ++version;
      try {
        const result = await getProviderVerification(userId);
        if (active && current === version) setRecord(result);
      } catch {
        if (active && current === version) setRecord(null);
      }
    };
    load();
    window.addEventListener('focus', load);
    window.addEventListener('edumatch:verification-updated', load);
    return () => {
      active = false;
      window.removeEventListener('focus', load);
      window.removeEventListener('edumatch:verification-updated', load);
    };
  }, [userId]);

  const backendVerified =
    String(record?.user_id) === String(userId) &&
    record?.verification_status === 'verified' &&
    Boolean(record?.verified_at);

  const localVerified =
    record?.verification_status !== 'rejected' &&
    Boolean(
      provider?.licenseVerificationStatus === 'verified' ||
        provider?.verificationStatus === 'verified' ||
        provider?.verification_status === 'verified' ||
        ['center-old-school', 'center-horizon-learning', 'center-trung-tam-day-du'].includes(String(userId || provider?.id))
    );

  if (!backendVerified && !localVerified) return null;

  const resolvedRole =
    record?.role ||
    provider?.role ||
    (provider?.providerType === 'center' ||
    provider?.licenseVerificationStatus === 'verified' ||
    ['center-old-school', 'center-horizon-learning', 'center-trung-tam-day-du'].includes(String(userId || provider?.id)) ||
    /^trung\s*tâm/i.test(String(provider?.name || '').trim())
      ? 'center'
      : 'teacher');

  return (
    <span className={`verified-provider-badge ${className}`.trim()}>
      <BadgeCheck size={13} aria-hidden="true" />
      {resolvedRole === 'center' ? 'Đã xác thực pháp lý' : 'Đã xác minh chuyên môn'}
    </span>
  );
}

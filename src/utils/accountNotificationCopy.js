import { ROUTES } from '@/constants/routes';

export const isApprovedVerificationNotification = (notification) =>
  notification?.type === 'verification_result' &&
  (String(notification?.title || '').toLowerCase().includes('phê duyệt') ||
    String(notification?.description || '').toLowerCase().includes('phê duyệt'));

export const formatNotificationCopy = (notification, isCenterAccount) => {
  if (
    isCenterAccount &&
    notification?.type === 'verification_result' &&
    !isApprovedVerificationNotification(notification)
  ) {
    const rawDesc = String(notification?.description || '').trim();
    const description = rawDesc.includes('liên hệ trực tiếp qua SĐT')
      ? rawDesc
      : `Hồ sơ chưa được xét duyệt${rawDesc ? `. Lý do: ${rawDesc}` : ''}. Đội ngũ EduMatch sẽ liên hệ trực tiếp qua SĐT để hướng dẫn.`;
    return {
      title: 'Hồ sơ xác thực chưa được xét duyệt',
      description,
    };
  }
  return {
    title: notification?.title || 'Bạn có thông báo mới',
    description: notification?.description || '',
  };
};

export const notificationDestination = (notification) => {
  if (isApprovedVerificationNotification(notification)) {
    return `${ROUTES.VERIFICATION}?celebrate=1`;
  }
  return notification?.link || ROUTES.HOME;
};

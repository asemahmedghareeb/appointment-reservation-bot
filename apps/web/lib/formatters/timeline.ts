import type { CaseTimelineItem } from '@visaflow/shared-types';
import arMessages from '../../messages/ar.json';

const AR_STATUSES = arMessages.statuses as Record<string, string>;

const AR_DESCRIPTIONS: Record<string, string> = {
  'Worker beginning provider authentication': 'بدء تسجيل الدخول والمصادقة مع مزود الخدمة',
  'Authentication and route inspection completed successfully': 'تم تسجيل الدخول وفحص مسار التأشيرة بنجاح',
  'All applicants validated and case ready for processing': 'تم التحقق من صحة بيانات جميع المتقدمين والحجز جاهز للمعالجة',
  'Booking case marked as READY': 'تم تحديد الحجز كجاهز لبدء الأتمتة',
  'Temporary error during availability check.': 'حدث خطأ مؤقت أثناء فحص توفر المواعيد',
  'Human challenge detected on login entry page.': 'تم رصد اختبار كابتشا (CAPTCHA) في صفحة تسجيل الدخول',
  'Verification required following credentials submission.': 'مطلوب إدخال رمز التحقق (OTP) بعد تقديم البيانات',
  'Human verification required during route inspection.': 'مطلوب تحقق بشري أثناء تحديد تفاصيل التأشيرة',
  'Human verification required during availability check.': 'مطلوب تحقق بشري أثناء فحص المواعيد المتاحة',
  'Navigation timeout or connection failure during authentication.': 'مهلة الاتصال انتهت أثناء محاولة تسجيل الدخول',
  'Failed to inspect and verify route details on VFS.': 'تعذر التحقق من تفاصيل مسار التأشيرة على بوابة المزود',
  'No active browser session found for availability check.': 'لا توجد جلسة متصفح نشطة لفحص المواعيد',
  'Selected slot was claimed by another party': 'تم حجز الموعد المختار من قبل مستخدم آخر',
  'Holding position in provider waiting room': 'في قائمة انتظار بوابة المزود',
  'Appointment officially booked and confirmed': 'تم تأكيد حجز الموعد رسمياً بنجاح',
  'Appointment slot locked and awaiting payment/confirmation': 'تم حجز الخانة مؤقتاً وبانتظار الدفع والتأكيد',
  'Operator intervention needed (2FA / OTP / Challenge)': 'مطلوب تدخل المشغل لحل التحدي الأمني',
  'Automation encountered an unrecoverable failure': 'واجهت الأتمتة خطأ غير قابل للاسترداد',
  'Booking case cancelled by operator': 'تم إلغاء طلب الحجز بواسطة المشغل',
};

function translateStatusName(statusStr: string | undefined): string {
  if (!statusStr) return '';
  return AR_STATUSES[statusStr] || statusStr;
}

export function formatTimelineEvent(
  item: CaseTimelineItem,
  locale: string,
): { title: string; description?: string | undefined } {
  if (locale !== 'ar') {
    return {
      title: item.title,
      description: item.description,
    };
  }

  let localizedTitle = item.title;

  // 1. Check if it is a state transition with known toStatus
  if (item.type === 'STATE_TRANSITION' && item.toStatus) {
    const toAr = translateStatusName(item.toStatus);
    localizedTitle = `تغيرت الحالة إلى ${toAr}`;
  } else {
    // Regex matches
    // Match: Case status transitioned from <STATUS1> to <STATUS2>
    const caseTransitionMatch = item.title.match(/^Case status transitioned from (\w+) to (\w+)$/i);
    if (caseTransitionMatch) {
      const fromAr = translateStatusName(caseTransitionMatch[1]);
      const toAr = translateStatusName(caseTransitionMatch[2]);
      localizedTitle = `انتقلت حالة الحجز من ${fromAr} إلى ${toAr}`;
    } else {
      // Match: Booking case <CASE_NUMBER> transitioned from <STATUS1> to <STATUS2>
      const bookingCaseMatch = item.title.match(/^Booking case (\S+) transitioned from (\w+) to (\w+)$/i);
      if (bookingCaseMatch) {
        const caseNum = bookingCaseMatch[1];
        const fromAr = translateStatusName(bookingCaseMatch[2]);
        const toAr = translateStatusName(bookingCaseMatch[3]);
        localizedTitle = `انتقل الحجز ${caseNum} من ${fromAr} إلى ${toAr}`;
      } else {
        // Match: Status changed to <STATUS>
        const statusChangedMatch = item.title.match(/^Status changed to (\w+)$/i);
        if (statusChangedMatch) {
          const toAr = translateStatusName(statusChangedMatch[1]);
          localizedTitle = `تغيرت الحالة إلى ${toAr}`;
        } else if (item.title.toLowerCase().startsWith('slot discovered:')) {
          localizedTitle = item.title.replace(/^slot discovered:\s*/i, 'تم العثور على موعد متاح: ');
        } else if (item.title.toLowerCase().startsWith('appointment slot detected for')) {
          localizedTitle = item.title.replace(/^appointment slot detected for\s*/i, 'تم اكتشاف موعد شاغر لـ ');
        }
      }
    }
  }

  // 2. Translate description
  let localizedDescription = item.description;
  if (item.description) {
    if (AR_DESCRIPTIONS[item.description]) {
      localizedDescription = AR_DESCRIPTIONS[item.description];
    } else if (item.description.startsWith('Slot discovered:')) {
      localizedDescription = item.description.replace(/^Slot discovered:\s*/i, 'تم العثور على موعد متاح: ');
    } else if (item.description.startsWith('Case stuck in')) {
      localizedDescription = item.description.replace(/^Case stuck in\s*/i, 'الحجز عالق في حالة: ');
    }
  }

  return {
    title: localizedTitle,
    description: localizedDescription,
  };
}

import {
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  FileText,
  GraduationCap,
  Headset,
  LockKeyhole,
  Mail,
  Phone,
  SearchCheck,
  SquareCheckBig,
  UserRound,
  Users,
} from "lucide-react";


export const registrationRoles = [
  {
    value: "student",
    label: "Học viên",
    accessibleLabel: "Tôi là học viên",
    icon: GraduationCap,
  },
  {
    value: "teacher",
    label: "Giáo viên",
    accessibleLabel: "Tôi là giáo viên",
    icon: UserRound,
  },
  {
    value: "center",
    label: "Trung tâm",
    accessibleLabel: "Trung tâm đào tạo",
    icon: Building2,
  },
];

export const roleContent = {
  student: {
    description:
      "Tham gia EduMatch để bắt đầu hành trình học tập hiệu quả hơn.",
    benefits: [
      { icon: SearchCheck, text: "Tìm giáo viên phù hợp với bạn" },
      { icon: BadgeCheck, text: "Học cùng giáo viên uy tín, chất lượng" },
      { icon: CalendarDays, text: "Chủ động lịch học, linh hoạt thời gian" },
      { icon: Headset, text: "Đội ngũ EduMatch luôn đồng hành" },
    ],
  },
  teacher: {
    description:
      "Bắt đầu hành trình giảng dạy và kết nối với nhiều học sinh hơn.",
    benefits: [
      { icon: Users, text: "Kết nối với học viên có nhu cầu học tập" },
      { icon: SquareCheckBig, text: "Xây dựng hồ sơ chuyên môn và uy tín" },
      {
        icon: CalendarDays,
        text: "Linh hoạt thời gian, dạy online hoặc offline",
      },
      { icon: Headset, text: "Được hỗ trợ tận tâm từ EduMatch" },
    ],
  },
  center: {
    description:
      "Tạo tài khoản cho trung tâm và giới thiệu chương trình đào tạo của bạn.",
    benefits: [
      { icon: Users, text: "Kết nối với học viên có nhu cầu học tập" },
      { icon: BookOpen, text: "Giới thiệu các chương trình đào tạo" },
      { icon: BadgeCheck, text: "Xây dựng hồ sơ và uy tín trung tâm" },
      { icon: Headset, text: "Đội ngũ EduMatch luôn đồng hành" },
    ],
  },
};

const passwordFields = [
  {
    name: "password",
    label: "Mật khẩu",
    icon: LockKeyhole,
    autoComplete: "new-password",
  },
  {
    name: "confirmPassword",
    label: "Nhập lại mật khẩu",
    icon: LockKeyhole,
    autoComplete: "new-password",
  },
];

const phoneField = {
  name: "phone",
  label: "Số điện thoại (tên đăng nhập)",
  placeholder: "Số điện thoại ( Tài khoản đăng nhập )",
  icon: Phone,
  type: "tel",
  autoComplete: "tel",
  maxLength: 12,
};

const emailField = {
  name: "email",
  label: "Email",
  icon: Mail,
  type: "email",
  autoComplete: "email",
  maxLength: 191,
};

// Keep the two supported formats easy to enter: 0xxxxxxxxx or +84xxxxxxxxx.
// The local format is capped at 10 digits while typing so an accidental extra
// digit cannot leave the form in an invalid state.
export function constrainPhoneInput(value) {
  const compact = String(value || "").replace(/[^\d+]/g, "");

  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "").slice(0, 11)}`;
  }

  return compact.replace(/\D/g, "").slice(0, 10);
}

export const accountFields = [
  {
    name: "name",
    label: "Họ và tên",
    icon: UserRound,
    autoComplete: "name",
    maxLength: 150,
  },
  {
    name: "dateOfBirth",
    label: "Ngày sinh",
    icon: CalendarDays,
    type: "date",
    autoComplete: "bday",
  },
  emailField,
  phoneField,
  ...passwordFields,
];

export const centerAccountFields = [
  {
    name: "centerName",
    label: "Tên trung tâm",
    placeholder: "Tên trung tâm",
    icon: Building2,
    autoComplete: "organization",
    maxLength: 200,
  },
  accountFields[1],
  phoneField,
  ...passwordFields,
];

export const teacherFields = [
  {
    name: "teachingField",
    label: "Lĩnh vực giảng dạy",
    placeholder: "Lĩnh Vực Giảng Dạy ...",
    icon: BookOpen,
    maxLength: 45,
    showCharacterCount: true,
  },
  {
    name: "qualification",
    label: "Bằng cấp, chứng chỉ",
    placeholder: "Bằng cấp/chứng chỉ",
    icon: Award,
    multiline: true,
    maxLength: 200,
    showCharacterCount: true,
  },
  {
    name: "experience",
    label: "Kinh nghiệm giảng dạy",
    placeholder: "Kinh nghiệm giảng dạy",
    icon: ChartNoAxesColumnIncreasing,
    multiline: true,
    maxLength: 500,
    showCharacterCount: true,
  },
  {
    name: "biography",
    label: "Hồ sơ năng lực",
    placeholder: "Chia sẻ về bản thân để học viên hiểu hơn về bạn.",
    icon: FileText,
    multiline: true,
  },
];

export const centerFields = [
  {
    name: "teachingField",
    label: "Lĩnh vực giảng dạy",
    placeholder: "Lĩnh Vực Giảng Dạy ...",
    icon: BookOpen,
    maxLength: 45,
    showCharacterCount: true,
  },
  {
    name: "foundedYear",
    label: "Năm thành lập",
    placeholder: "Ví dụ: 2018",
    icon: CalendarDays,
    maxLength: 4,
  },
  {
    name: "centerDescription",
    label: "Hồ sơ năng lực",
    placeholder: "Chia sẻ thêm để học viên hiểu hơn về trung tâm của bạn.",
    icon: FileText,
    multiline: true,
  },
];

export const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  dateOfBirth: "",
  experience: "",
  qualification: "",
  biography: "",
  centerName: "",
  centerDescription: "",
  foundedYear: "",
  teachingField: "",
  isPhonePublic: true,
};

export function getTodayDate(today = new Date()) {
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function validBirthDate(value, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(value + "T00:00:00");
  return (
    year > 0 &&
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day &&
    value <= getTodayDate(today)
  );
}

export function validateRegistration(form, role, today = new Date()) {
  const errors = {};
  if (role === "center") {
    if (form.centerName.trim().length < 2)
      errors.centerName = "Vui lòng nhập tên trung tâm (ít nhất 2 ký tự).";
    else if (form.centerName.trim().length > 200)
      errors.centerName = "Tên trung tâm tối đa 200 ký tự.";
  } else {
    if (form.name.trim().length < 2)
      errors.name = "Vui lòng nhập họ và tên (ít nhất 2 ký tự).";
    else if (form.name.trim().length > 150)
      errors.name = "Họ và tên tối đa 150 ký tự.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = "Vui lòng nhập email hợp lệ.";
  else if (form.email.trim().length > 191)
    errors.email = "Email tối đa 191 ký tự.";
  if (!/^(?:0|\+84)[35789]\d{8}$/.test(form.phone.replace(/[\s.-]/g, "")))
    errors.phone = "Nhập 10 số (ví dụ 0989898989), hoặc +84 rồi 9 số.";
  if (role !== "center") {
    if (!form.dateOfBirth) errors.dateOfBirth = "Vui lòng chọn ngày sinh.";
    else if (!validBirthDate(form.dateOfBirth, today))
      errors.dateOfBirth =
        "Ngày sinh phải hợp lệ và không nằm trong tương lai.";
  }
  if (form.password.length < 8)
    errors.password = "Mật khẩu cần có ít nhất 8 ký tự.";
  else if (form.password.length > 128)
    errors.password = "Mật khẩu tối đa 128 ký tự.";
  if (!form.confirmPassword)
    errors.confirmPassword = "Vui lòng xác nhận mật khẩu.";
  else if (form.password !== form.confirmPassword)
    errors.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
  if (role === "teacher") {
    teacherFields.forEach(({ name, label }) => {
      if (!form[name].trim())
        errors[name] = `Vui lòng nhập ${label.toLowerCase()}.`;
    });
    if (form.qualification.length > 200) errors.qualification = "Bằng cấp/tiêu đề nghề nghiệp tối đa 200 ký tự.";
    if (form.teachingField.trim().length > 45) errors.teachingField = "Lĩnh vực giảng dạy tối đa 45 ký tự.";
    const years = Number.parseInt(form.experience, 10);
    if (!Number.isInteger(years) || years < 0 || years > 60) errors.experience = "Nhập số năm kinh nghiệm từ 0 đến 60 (ví dụ: 5 năm).";
  } else if (role === "center") {
    if (!form.centerDescription.trim()) errors.centerDescription = "Vui lòng nhập thông tin mô tả về trung tâm.";
    if (!form.teachingField.trim()) errors.teachingField = "Vui lòng nhập lĩnh vực giảng dạy.";
    else if (form.teachingField.trim().length > 45) errors.teachingField = "Lĩnh vực giảng dạy tối đa 45 ký tự.";
  }
  if (role === "center" && !/^\d{4}$/.test(form.foundedYear))
    errors.foundedYear = "Vui lòng nhập năm thành lập gồm 4 chữ số.";
  else if (role === "center" && (Number(form.foundedYear) < 1950 || Number(form.foundedYear) > today.getFullYear()))
    errors.foundedYear = "Năm thành lập phải từ 1950 đến năm hiện tại.";
  return errors;
}

// Only include the active role's fields; hidden profile values never reach the API.
export function buildRegistrationPayload(form, role) {
  const profileText = (value) => String(value || "").trim();
  const data = {
    name: (role === "center" ? form.centerName : form.name).trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.replace(/[\s.-]/g, ""),
    password: form.password,
    password_confirmation: form.confirmPassword,
    role,
    fullName: (role === "center" ? form.centerName : form.name).trim(),
    ...(["teacher", "center"].includes(role) && { isPhonePublic: form.isPhonePublic, show_phone: Boolean(form.isPhonePublic) }),
  };
  if (role === "center") {
    return {
      ...data,
      // `bio` belongs to the generic account profile, where the API limits text
      // to 5,000 characters. A center's capability profile is intentionally
      // unrestricted, so only send it through the center-specific description.
      centerDescription: profileText(form.centerDescription),
      center_description: profileText(form.centerDescription),
      description: profileText(form.centerDescription),
      foundedYear: form.foundedYear,
      founded_year: Number(form.foundedYear),
      teachingField: profileText(form.teachingField),
      teaching_field: profileText(form.teachingField),
      centerProfile: {
        description: profileText(form.centerDescription),
        foundedYear: form.foundedYear,
        teachingField: profileText(form.teachingField),
        teaching_field: profileText(form.teachingField),
      },
    };
  }
  return {
    ...data,
    date_of_birth: form.dateOfBirth,
    dateOfBirth: form.dateOfBirth,
    dob: form.dateOfBirth,
    ...(role === "teacher" && {
      qualifications: profileText(form.qualification),
      headline: form.qualification.trim(),
      experience_years: Number.parseInt(form.experience, 10) || 0,
      show_phone: Boolean(form.isPhonePublic),
      experience: profileText(form.experience),
      bio: profileText(form.biography),
      teachingField: profileText(form.teachingField),
      teaching_field: profileText(form.teachingField),
      teacherProfile: Object.fromEntries(
        teacherFields.map(({ name }) => [name, profileText(form[name])]),
      ),
    }),
  };
}

export function mapRegistrationErrors(serverErrors = {}, role = 'student') {
  const aliases = {
    full_name: 'name', fullName: 'name',
    date_of_birth: 'dateOfBirth', dob: 'dateOfBirth',
    password_confirmation: 'confirmPassword',
    headline: 'qualification', experience_years: 'experience', founded_year: 'foundedYear', teaching_field: 'teachingField',
    ...(role === 'center'
      ? {
          name: 'centerName',
          bio: 'centerDescription',
          description: 'centerDescription',
          centerDescription: 'centerDescription',
          center_description: 'centerDescription',
          'centerProfile.description': 'centerDescription',
          'center_profile.description': 'centerDescription',
        }
      : role === 'teacher'
        ? { bio: 'biography', show_phone: 'isPhonePublic' }
        : {}),
  };
  return Object.fromEntries(Object.entries(serverErrors).map(([field, messages]) => [
    aliases[field] || field,
    Array.isArray(messages) ? messages[0] : messages,
  ]));
}

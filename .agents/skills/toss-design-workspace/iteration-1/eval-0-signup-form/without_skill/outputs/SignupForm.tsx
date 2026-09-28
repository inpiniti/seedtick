import React, { useState } from "react";

/**
 * 회원가입 폼 컴포넌트
 * - 이메일, 비밀번호, 닉네임 입력
 * - 입력값 검증 및 에러 메시지 표시
 * - 단일 파일, 외부 의존성 없음 (React만 사용)
 */

interface SignupFormValues {
  email: string;
  password: string;
  nickname: string;
}

type SignupFormErrors = Partial<Record<keyof SignupFormValues, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: SignupFormValues): SignupFormErrors {
  const errors: SignupFormErrors = {};

  if (!values.email.trim()) {
    errors.email = "이메일을 입력해주세요.";
  } else if (!EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "올바른 이메일 형식이 아닙니다.";
  }

  if (!values.password) {
    errors.password = "비밀번호를 입력해주세요.";
  } else if (values.password.length < 8) {
    errors.password = "비밀번호는 8자 이상이어야 합니다.";
  } else if (!/[a-zA-Z]/.test(values.password) || !/[0-9]/.test(values.password)) {
    errors.password = "비밀번호는 영문과 숫자를 모두 포함해야 합니다.";
  }

  if (!values.nickname.trim()) {
    errors.nickname = "닉네임을 입력해주세요.";
  } else if (values.nickname.trim().length < 2 || values.nickname.trim().length > 12) {
    errors.nickname = "닉네임은 2~12자로 입력해주세요.";
  }

  return errors;
}

export interface SignupFormProps {
  /** 검증 통과 후 가입 처리 콜백 (선택) */
  onSubmit?: (values: SignupFormValues) => void | Promise<void>;
}

export default function SignupForm({ onSubmit }: SignupFormProps) {
  const [values, setValues] = useState<SignupFormValues>({
    email: "",
    password: "",
    nickname: "",
  });
  const [errors, setErrors] = useState<SignupFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof SignupFormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof SignupFormValues) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    // 이미 터치된 필드는 입력 즉시 재검증
    if (touched[field]) {
      setErrors(validate(next));
    }
  };

  const handleBlur = (field: keyof SignupFormValues) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(values));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setTouched({ email: true, password: true, nickname: true });

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSubmitting(true);
      await onSubmit?.({
        ...values,
        email: values.email.trim(),
        nickname: values.nickname.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const showError = (field: keyof SignupFormValues) =>
    touched[field] && errors[field] ? errors[field] : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate style={styles.form}>
      <h2 style={styles.title}>회원가입</h2>

      <div style={styles.field}>
        <label htmlFor="signup-email" style={styles.label}>
          이메일
        </label>
        <input
          id="signup-email"
          type="email"
          value={values.email}
          onChange={handleChange("email")}
          onBlur={handleBlur("email")}
          placeholder="example@email.com"
          autoComplete="email"
          aria-invalid={!!showError("email")}
          aria-describedby={showError("email") ? "signup-email-error" : undefined}
          style={{ ...styles.input, ...(showError("email") ? styles.inputError : {}) }}
        />
        {showError("email") && (
          <p id="signup-email-error" role="alert" style={styles.errorText}>
            {errors.email}
          </p>
        )}
      </div>

      <div style={styles.field}>
        <label htmlFor="signup-password" style={styles.label}>
          비밀번호
        </label>
        <input
          id="signup-password"
          type="password"
          value={values.password}
          onChange={handleChange("password")}
          onBlur={handleBlur("password")}
          placeholder="영문, 숫자 포함 8자 이상"
          autoComplete="new-password"
          aria-invalid={!!showError("password")}
          aria-describedby={showError("password") ? "signup-password-error" : undefined}
          style={{ ...styles.input, ...(showError("password") ? styles.inputError : {}) }}
        />
        {showError("password") && (
          <p id="signup-password-error" role="alert" style={styles.errorText}>
            {errors.password}
          </p>
        )}
      </div>

      <div style={styles.field}>
        <label htmlFor="signup-nickname" style={styles.label}>
          닉네임
        </label>
        <input
          id="signup-nickname"
          type="text"
          value={values.nickname}
          onChange={handleChange("nickname")}
          onBlur={handleBlur("nickname")}
          placeholder="2~12자"
          autoComplete="nickname"
          aria-invalid={!!showError("nickname")}
          aria-describedby={showError("nickname") ? "signup-nickname-error" : undefined}
          style={{ ...styles.input, ...(showError("nickname") ? styles.inputError : {}) }}
        />
        {showError("nickname") && (
          <p id="signup-nickname-error" role="alert" style={styles.errorText}>
            {errors.nickname}
          </p>
        )}
      </div>

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? "가입 중..." : "가입하기"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    maxWidth: 400,
    margin: "0 auto",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    fontFamily: "sans-serif",
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    padding: "10px 12px",
    fontSize: 15,
    border: "1px solid #ccc",
    borderRadius: 8,
    outline: "none",
  },
  inputError: {
    border: "1px solid #e5484d",
  },
  errorText: {
    margin: 0,
    fontSize: 13,
    color: "#e5484d",
  },
  button: {
    marginTop: 8,
    padding: "12px 16px",
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#3182f6",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
};

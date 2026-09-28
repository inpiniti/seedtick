import React, { useRef, useState } from "react";

/* ============================================================
 * 토스 스타일 회원가입 폼 (단일 파일 컴포넌트)
 * - 비주얼 토큰: 컬러·radius·그림자·타이포 (toss-design 스킬 기준)
 * - UX 라이팅: 해요체 · 능동형 · 긍정형 에러 문구
 * - 인터랙션: 클릭 즉시 인라인 로딩(도허티), 성공 토스트(피크엔드),
 *   터치 타깃 ≥ 44px(피츠), 화면당 fill CTA 1개(폰 레스토프)
 * ============================================================ */

/* ---------- 디자인 토큰 ---------- */
const t = {
  bg: "#f7f9fc",
  surface: "#ffffff",
  textPrimary: "#191f28",
  textSecondary: "#4e5968",
  textTertiary: "#8b95a1",
  divider: "#e5e8eb",
  primary: "#3182f6",
  danger: "#f04452",
  success: "#03b26c",
} as const;

/* ---------- 타입 ---------- */
type FieldName = "email" | "password" | "nickname";
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;
type Touched = Partial<Record<FieldName, boolean>>;

export interface SignupFormProps {
  /** 실제 가입 처리. 없으면 데모용으로 1초 대기 후 성공 처리해요. */
  onSubmit?: (values: Values) => Promise<void>;
}

/* ---------- 검증 — 에러 문구는 "어떻게 하면 되는지"로 (긍정형) ---------- */
function validateField(name: FieldName, value: string): string | undefined {
  const v = value.trim();
  switch (name) {
    case "email":
      if (!v) return "이메일을 입력해 주세요";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
        return "이메일 형식으로 입력해 주세요 (예: toss@example.com)";
      return undefined;
    case "password":
      if (!v) return "비밀번호를 입력해 주세요";
      if (v.length < 8 || !/[0-9]/.test(v) || !/[a-zA-Z]/.test(v))
        return "8자 이상, 영문과 숫자를 함께 써 주세요";
      return undefined;
    case "nickname":
      if (!v) return "닉네임을 입력해 주세요";
      if (!/^[가-힣a-zA-Z0-9]{2,10}$/.test(v))
        return "2~10자, 한글·영문·숫자로 지어 주세요";
      return undefined;
  }
}

function validateAll(values: Values): Errors {
  const errors: Errors = {};
  (Object.keys(values) as FieldName[]).forEach((name) => {
    const message = validateField(name, values[name]);
    if (message) errors[name] = message;
  });
  return errors;
}

/* ---------- 입력 필드 (box variant: label + input + help/error) ---------- */
interface TextFieldProps {
  name: FieldName;
  label: string;
  value: string;
  placeholder: string;
  help?: string;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (name: FieldName, value: string) => void;
  onBlur: (name: FieldName) => void;
  /** 우측 액세서리 (비밀번호 표시 토글 등) */
  accessory?: React.ReactNode;
}

function TextField({
  name,
  label,
  value,
  placeholder,
  help,
  error,
  type = "text",
  inputMode,
  autoComplete,
  inputRef,
  onChange,
  onBlur,
  accessory,
}: TextFieldProps) {
  const messageId = `${name}-message`;
  const hasError = Boolean(error);

  return (
    <div style={{ marginBottom: 20 }}>
      <label
        htmlFor={name}
        style={{
          display: "block",
          fontSize: "0.8125rem",
          fontWeight: 600,
          lineHeight: 1.4,
          color: hasError ? t.danger : t.textSecondary,
          marginBottom: 8,
        }}
      >
        {label}
      </label>

      <div style={{ position: "relative" }}>
        <input
          id={name}
          name={name}
          ref={inputRef}
          className="sf-input"
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          aria-invalid={hasError || undefined}
          aria-describedby={help || error ? messageId : undefined}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={() => onBlur(name)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            minHeight: 52, // 터치 타깃 ≥ 44px
            padding: accessory ? "14px 52px 14px 16px" : "14px 16px",
            fontSize: "0.9375rem",
            lineHeight: 1.5,
            color: t.textPrimary,
            background: t.surface,
            border: `1.5px solid ${hasError ? t.danger : t.divider}`,
            borderRadius: 12,
            outline: "none",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          }}
        />
        {accessory && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 4,
              height: "100%",
              display: "flex",
              alignItems: "center",
            }}
          >
            {accessory}
          </div>
        )}
      </div>

      {(error || help) && (
        <p
          id={messageId}
          aria-live="polite"
          style={{
            margin: "6px 2px 0",
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            color: hasError ? t.danger : t.textTertiary,
          }}
        >
          {error ?? help}
        </p>
      )}
    </div>
  );
}

/* ---------- 회원가입 폼 ---------- */
export default function SignupForm({ onSubmit }: SignupFormProps) {
  const [values, setValues] = useState<Values>({
    email: "",
    password: "",
    nickname: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Touched>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refs: Record<FieldName, React.RefObject<HTMLInputElement>> = {
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    nickname: useRef<HTMLInputElement>(null),
  };

  const handleChange = (name: FieldName, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // 이미 만진 필드는 입력 즉시 재검증 — 고치는 순간 에러가 사라진다 (도허티)
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (name: FieldName) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, values[name]) }));
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000); // 버튼 없는 토스트는 3초
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // 더블 클릭 방지

    const nextErrors = validateAll(values);
    setErrors(nextErrors);
    setTouched({ email: true, password: true, nickname: true });

    const firstInvalid = (["email", "password", "nickname"] as FieldName[]).find(
      (name) => nextErrors[name]
    );
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    setLoading(true); // 클릭 즉시 인라인 로딩 (도허티 0.4초)
    try {
      if (onSubmit) {
        await onSubmit({ ...values, email: values.email.trim(), nickname: values.nickname.trim() });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      showToast(`${values.nickname.trim()}님, 가입했어요. 환영해요!`);
    } catch {
      showToast("잠시 연결이 어려워요. 조금 뒤에 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "48px 20px calc(24px + env(safe-area-inset-bottom))",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
      }}
    >
      {/* 포커스 링·스피너·토스트 애니메이션 (인라인 스타일로 불가능한 상태 스타일) */}
      <style>{`
        .sf-input::placeholder { color: ${t.textTertiary}; }
        .sf-input:focus {
          border-color: ${t.primary} !important;
          box-shadow: 0 0 0 3px rgba(49, 130, 246, 0.15);
        }
        .sf-input[aria-invalid="true"]:focus {
          border-color: ${t.danger} !important;
          box-shadow: 0 0 0 3px rgba(240, 68, 82, 0.12);
        }
        .sf-cta:not(:disabled):hover { background: #1b6ef3; }
        .sf-cta:not(:disabled):active { transform: scale(0.98); }
        .sf-ghost-btn:hover { color: ${t.textSecondary}; }
        @keyframes sf-spin { to { transform: rotate(360deg); } }
        @keyframes sf-toast-in {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      <main
        style={{
          width: "100%",
          maxWidth: 400,
          background: t.surface,
          borderRadius: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          padding: "32px 24px 24px",
        }}
      >
        {/* 헤더 — 한 화면, 하나의 목적 */}
        <h1
          style={{
            margin: 0,
            fontSize: "1.375rem",
            fontWeight: 700,
            lineHeight: 1.4,
            color: t.textPrimary,
          }}
        >
          환영해요!
        </h1>
        <p
          style={{
            margin: "6px 0 28px",
            fontSize: "0.9375rem",
            lineHeight: 1.5,
            color: t.textSecondary,
          }}
        >
          가입에 필요한 정보를 입력해 주세요
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            name="email"
            label="이메일"
            value={values.email}
            placeholder="toss@example.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            error={touched.email ? errors.email : undefined}
            inputRef={refs.email}
            onChange={handleChange}
            onBlur={handleBlur}
          />

          <TextField
            name="password"
            label="비밀번호"
            value={values.password}
            placeholder="비밀번호"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            help="8자 이상, 영문과 숫자를 함께 써 주세요"
            error={touched.password ? errors.password : undefined}
            inputRef={refs.password}
            onChange={handleChange}
            onBlur={handleBlur}
            accessory={
              <button
                type="button"
                className="sf-ghost-btn"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  minWidth: 44,
                  minHeight: 44, // 터치 타깃 ≥ 44px
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "1.125rem",
                  color: t.textTertiary,
                  padding: 0,
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            }
          />

          <TextField
            name="nickname"
            label="닉네임"
            value={values.nickname}
            placeholder="어떻게 불러드릴까요?"
            autoComplete="nickname"
            help="2~10자, 한글·영문·숫자를 쓸 수 있어요"
            error={touched.nickname ? errors.nickname : undefined}
            inputRef={refs.nickname}
            onChange={handleChange}
            onBlur={handleBlur}
          />

          {/* CTA — 화면당 fill 버튼 1개, 라벨은 행동 그대로 */}
          <button
            type="submit"
            className="sf-cta"
            disabled={loading}
            aria-busy={loading || undefined}
            style={{
              width: "100%",
              minHeight: 56,
              marginTop: 8,
              border: "none",
              borderRadius: 14,
              background: t.primary,
              color: "#ffffff",
              fontSize: "1.0625rem",
              fontWeight: 700,
              lineHeight: 1.4,
              cursor: loading ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.15s ease, transform 0.1s ease",
              opacity: loading ? 0.85 : 1,
            }}
          >
            {loading && (
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  border: "2.5px solid rgba(255,255,255,0.35)",
                  borderTopColor: "#ffffff",
                  borderRadius: "50%",
                  animation: "sf-spin 0.7s linear infinite",
                }}
              />
            )}
            {loading ? "가입하고 있어요…" : "가입하기"}
          </button>
        </form>
      </main>

      {/* 성공 피드백 토스트 — 흐름을 끊지 않는 3초 알림 */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "calc(24px + env(safe-area-inset-bottom))",
            transform: "translateX(-50%)",
            maxWidth: "calc(100vw - 40px)",
            background: "rgba(25, 31, 40, 0.92)",
            color: "#ffffff",
            fontSize: "0.9375rem",
            lineHeight: 1.5,
            padding: "14px 20px",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "sf-toast-in 0.25s ease",
            zIndex: 100,
          }}
        >
          <span aria-hidden="true" style={{ color: t.success, fontWeight: 700 }}>
            ✓
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

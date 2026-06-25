'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { signIn, signUp } from '@/lib/auth/session';
import { cn } from '@/lib/utils/cn';

const EMAIL_DOMAIN = '@qq.com';

const INPUT_CLASS =
  'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-brand/15';

const EMAIL_CLASS = cn(
  INPUT_CLASS,
  'pr-11 read-only:cursor-default read-only:bg-slate-100 read-only:text-slate-500',
);

export interface LoginFormProps {
  onSuccess: () => void;
  lead?: string;
  initialUsername?: string;
}

export function LoginForm({
  onSuccess,
  lead = '登录后可管理你的配置与历史',
  initialUsername = '',
}: LoginFormProps): React.ReactElement {
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailManual, setEmailManual] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const syncEmail = useCallback(
    (nextUsername: string) => {
      if (emailManual) {
        return;
      }
      const trimmed = nextUsername.trim();
      setEmail(trimmed ? `${trimmed}${EMAIL_DOMAIN}` : '');
    },
    [emailManual],
  );

  useEffect(() => {
    syncEmail(username);
  }, [username, syncEmail]);

  const toggleEmailManual = (): void => {
    setEmailManual((prev) => {
      const next = !prev;
      if (!next) {
        syncEmail(username);
      }
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError('请填写用户名与密码');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (isRegister) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
          setError('请填写邮箱');
          return;
        }
        await signUp(trimmedEmail, trimmedUsername, password);
      } else {
        await signIn(trimmedUsername, password);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_6px_16px_rgb(25_118_210/0.32)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-6 w-6"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
          {isRegister ? '注册' : '登录'}
        </h2>
        <p className="m-0 text-[13px] leading-relaxed text-slate-500">{lead}</p>
      </div>

      <form className="flex flex-col gap-3.5" autoComplete="off" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-slate-700" htmlFor={usernameId}>
            用户名
          </label>
          <input
            id={usernameId}
            type="text"
            name="username"
            autoComplete="off"
            className={INPUT_CLASS}
            placeholder="请输入用户名"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        {isRegister ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-slate-700" htmlFor={emailId}>
              邮箱
            </label>
            <div className="relative">
              <input
                id={emailId}
                type="email"
                name="email"
                autoComplete="off"
                readOnly={!emailManual}
                className={EMAIL_CLASS}
                placeholder="按用户名自动生成"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button
                type="button"
                className={cn(
                  'absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-transparent text-slate-400 transition hover:bg-slate-200 hover:text-slate-600',
                  emailManual && 'bg-brand/10 text-brand',
                )}
                aria-label={emailManual ? '恢复按用户名自动生成' : '允许修改邮箱'}
                title={emailManual ? '点击恢复按用户名自动生成' : '点击允许手动修改邮箱'}
                onClick={toggleEmailManual}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-slate-700" htmlFor={passwordId}>
            密码
          </label>
          <input
            id={passwordId}
            type="password"
            name="password"
            autoComplete="off"
            className={INPUT_CLASS}
            placeholder="请输入密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? (
          <p className="m-0 text-[13px] leading-snug text-red-600">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 inline-flex h-[46px] w-full items-center justify-center rounded-xl bg-brand text-[15px] font-semibold text-white shadow-[0_6px_18px_rgb(25_118_210/0.3)] transition hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isRegister ? '注册' : '登录'}
        </button>

        <button
          type="button"
          className="auth-switch mx-auto mt-1 bg-transparent px-2 py-1 text-[13px] text-slate-500 transition hover:text-brand"
          onClick={() => {
            setMode(isRegister ? 'signin' : 'register');
            setError('');
          }}
        >
          {isRegister ? (
            <>
              已有账号？<b className="font-semibold text-brand">返回登录</b>
            </>
          ) : (
            <>
              没有账号？<b className="font-semibold text-brand">立即注册</b>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

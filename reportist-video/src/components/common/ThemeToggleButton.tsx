// components/common/ThemeToggleButton.tsx — Animate UI ThemeToggler 기반 테마 전환 버튼.
// StudioTopBar의 가이드·설정 버튼과 같은 그룹에 들어가는 아이콘 전용 버튼이다.

import { Moon, Sun } from 'lucide-react';
import {
  ThemeToggler,
  type ThemeSelection,
} from '@animate-ui/react/primitives/effects/theme-toggler';
import { useTheme } from '../../hooks/useTheme.ts';
import { useI18n } from '../../i18n/index.tsx';
import { Tooltip } from '../ui/Tooltip.tsx';

export function ThemeToggleButton() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { ui } = useI18n();

  return (
    <ThemeToggler
      theme={theme}
      resolvedTheme={resolvedTheme}
      setTheme={setTheme}
      direction="ltr"
    >
      {({ effective, toggleTheme }) => {
        const isDark =
          effective === 'dark' || (effective === 'system' && resolvedTheme === 'dark');
        const label = isDark ? ui('라이트 테마로 전환') : ui('다크 테마로 전환');
        const next: ThemeSelection = isDark ? 'light' : 'dark';

        return (
          <Tooltip content={label}>
            <button
              type="button"
              className="sv2-btn sv2-btn-icon sv2-settings-trigger"
              onClick={() => toggleTheme(next)}
              aria-label={label}
              aria-pressed={isDark}
              data-tour="theme-toggle"
            >
              {isDark ? (
                <Sun size={18} aria-hidden="true" />
              ) : (
                <Moon size={18} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        );
      }}
    </ThemeToggler>
  );
}

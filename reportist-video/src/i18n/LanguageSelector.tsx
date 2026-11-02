// src/i18n/LanguageSelector.tsx - Toss-style internationalization dropdown
import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useI18n } from './index.tsx';
import type { Locale } from './types.ts';

export const LanguageSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { locale, setLocale, locales, currentLocaleInfo } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: Locale) => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div className={`toss-lang-selector-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`toss-model-trigger toss-lang-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Select Language / 언어 선택"
      >
        <span className="toss-model-trigger-icon">
          <Globe size={13} className="text-blue-500" />
        </span>
        <span className="toss-model-trigger-text">
          <span className="toss-model-trigger-label">Language</span>
          <span className="toss-model-trigger-name flex items-center gap-1.5">
            <span className="text-xs">{currentLocaleInfo.flag}</span>
            <span>{currentLocaleInfo.nativeName}</span>
          </span>
        </span>
        <ChevronDown size={14} className="toss-model-trigger-chevron" />
      </button>

      {isOpen && (
        <div className="toss-lang-dropdown-menu" role="menu">
          <div className="toss-lang-dropdown-header">
            <span>Select Language</span>
          </div>
          <div className="toss-lang-dropdown-list">
            {locales.map((loc) => {
              const isSelected = loc.code === locale;
              return (
                <button
                  key={loc.code}
                  type="button"
                  className={`toss-lang-menu-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(loc.code)}
                  role="menuitem"
                >
                  <span className="toss-lang-flag">{loc.flag}</span>
                  <div className="toss-lang-info">
                    <span className="toss-lang-native">{loc.nativeName}</span>
                    <span className="toss-lang-english">{loc.name}</span>
                  </div>
                  {isSelected && (
                    <Check size={14} className="toss-lang-check ml-auto text-blue-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

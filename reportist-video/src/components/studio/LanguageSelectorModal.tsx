// src/components/studio/LanguageSelectorModal.tsx - Modal for selecting language (Toss modal style)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Search, X, Check, Sparkles } from 'lucide-react';
import { DICTIONARIES, useI18n } from '../../i18n/index.tsx';
import type { Locale } from '../../i18n/types.ts';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';
import { notify } from '../../services/toastService.ts';

export interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { locale, setLocale, locales, dict, interpolate } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.language-modal-list, .model-modal-list, [data-modal-scrollable="true"]',
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredLocales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return locales;
    return locales.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.nativeName.toLowerCase().includes(q) ||
        loc.code.toLowerCase().includes(q)
    );
  }, [locales, searchQuery]);

  if (!isOpen) return null;

  const handleSelectLanguage = (code: Locale) => {
    const selected = locales.find((l) => l.code === code);
    // Toast should be shown in the newly selected language, not the previous one.
    const nextDict = DICTIONARIES[code] || dict;
    setLocale(code);
    onClose();
    const flag = selected?.flag || '🌐';
    const name = selected ? `${selected.nativeName} (${selected.name})` : code;
    notify.success(`${flag} ${selected?.nativeName || code}`, {
      description: interpolate(nextDict.toasts.languageChangedDesc, { language: name }),
    });
  };

  return (
    <div
      ref={overlayRef}
      className="model-modal-backdrop"
      onClick={onClose}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className="model-modal-card language-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-modal-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <Globe size={22} color="#0f172a" />
            </div>
            <div>
              <h2 className="model-modal-title" id="language-modal-title">
                {dict.languageModal.title}
              </h2>
              <p className="model-modal-subtitle">
                {dict.languageModal.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search section */}
        <div className="model-modal-search-section">
          <div className="model-modal-search-wrapper">
            <Search size={18} className="model-modal-search-icon" />
            <input
              type="text"
              placeholder={dict.languageModal.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="model-modal-search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="model-modal-clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label={dict.common.delete}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Language List */}
        <div
          className="model-modal-list language-modal-list"
          data-modal-scrollable="true"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {filteredLocales.length === 0 ? (
            <div className="model-modal-empty">
              <Globe size={36} color="#8b95a1" />
              <p className="model-modal-empty-title">{dict.languageModal.title}</p>
              <p className="model-modal-empty-desc">
                {dict.languageModal.searchPlaceholder}
              </p>
            </div>
          ) : (
            filteredLocales.map((loc) => {
              const isSelected = loc.code === locale;
              return (
                <div
                  key={loc.code}
                  className={`language-modal-item ${isSelected ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectLanguage(loc.code)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectLanguage(loc.code);
                    }
                  }}
                >
                  <div className="language-modal-item-left">
                    <div className="language-modal-flag-badge">
                      <span>{loc.flag}</span>
                    </div>
                    <div className="language-modal-item-text">
                      <div className="language-modal-item-native-row">
                        <span className="language-modal-item-native">{loc.nativeName}</span>
                        {loc.code === 'en' && (
                          <span className="language-modal-badge default">
                            {dict.languageModal.defaultBadge}
                          </span>
                        )}
                        <span className="language-modal-badge supported">
                          {dict.languageModal.supportedBadge}
                        </span>
                      </div>
                      <span className="language-modal-item-english">{loc.name}</span>
                    </div>
                  </div>

                  <div className="language-modal-item-right">
                    <div
                      className={`model-modal-check-badge ${
                        isSelected ? 'selected' : 'unselected'
                      }`}
                    >
                      {isSelected && <Check size={16} color="#ffffff" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="model-modal-footer">
          <div className="model-modal-footer-tip">
            <Sparkles size={14} color="#0f172a" />
            <span>{dict.languageModal.tip}</span>
          </div>
          <button
            type="button"
            className="model-modal-confirm-btn"
            onClick={onClose}
          >
            {dict.languageModal.close}
          </button>
        </div>
      </div>
    </div>
  );
};

'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { cn } from '@/lib/utils/cn';

const CHECK_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M13.485 3.515a1 1 0 0 1 0 1.414l-7.07 7.071-3.536-3.536a1 1 0 1 1 1.414-1.415l2.122 2.122 6.364-6.364a1 1 0 0 1 1.414 0z" />
  </svg>
);

export interface DropdownSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownSelectGroup {
  label: string;
  options: DropdownSelectOption[];
}

export interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: DropdownSelectOption[];
  groups?: DropdownSelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

const MENU_GAP = 6;
const VIEWPORT_PADDING = 8;
const MENU_MIN_HEIGHT = 120;

function ChevronIcon(): React.ReactElement {
  return (
    <svg
      className="fb-select__chevron"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function flattenOptions(
  options: DropdownSelectOption[] | undefined,
  groups: DropdownSelectGroup[] | undefined,
): DropdownSelectOption[] {
  if (groups && groups.length > 0) {
    return groups.flatMap((group) => group.options);
  }
  return options ?? [];
}

export function DropdownSelect({
  value,
  onChange,
  options,
  groups,
  placeholder = '请选择',
  disabled = false,
  className,
  id,
  name,
}: DropdownSelectProps): React.ReactElement {
  const autoId = useId();
  const selectId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [opensUpward, setOpensUpward] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const allOptions = flattenOptions(options, groups);
  const selected = allOptions.find((option) => option.value === value);
  const enabledOptions = allOptions.filter((option) => !option.disabled && option.value);

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight || menu.scrollHeight;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
    const spaceAbove = rect.top - VIEWPORT_PADDING;
    const estimatedHeight = menuHeight || MENU_MIN_HEIGHT;
    const shouldOpenUp =
      spaceBelow < estimatedHeight + MENU_GAP && spaceAbove >= spaceBelow;

    setOpensUpward(shouldOpenUp);

    menu.style.position = 'fixed';
    menu.style.left = `${rect.left}px`;
    menu.style.minWidth = `${rect.width}px`;
    menu.style.bottom = 'auto';

    const availableSpace = shouldOpenUp
      ? spaceAbove - MENU_GAP
      : spaceBelow - MENU_GAP;

    if (availableSpace > 0) {
      menu.style.maxHeight = `${Math.max(MENU_MIN_HEIGHT, availableSpace)}px`;
      menu.style.overflowY = 'auto';
    } else {
      menu.style.maxHeight = '';
      menu.style.overflowY = '';
    }

    if (shouldOpenUp) {
      const top = rect.top - MENU_GAP - (menu.offsetHeight || menuHeight);
      menu.style.top = `${Math.max(VIEWPORT_PADDING, top)}px`;
    } else {
      menu.style.top = `${rect.bottom + MENU_GAP}px`;
    }

    const menuWidth = Math.max(rect.width, menu.offsetWidth);
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - VIEWPORT_PADDING - menuWidth;
    }
    menu.style.left = `${Math.max(VIEWPORT_PADDING, left)}px`;
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    positionMenu();
    setOpen(true);
    setFocusedIndex(-1);
  }, [disabled, positionMenu]);

  const selectValue = useCallback(
    (nextValue: string) => {
      if (nextValue !== value) {
        onChange(nextValue);
      }
      close();
    },
    [close, onChange, value],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => positionMenu());
    return () => cancelAnimationFrame(frame);
  }, [open, positionMenu, allOptions.length]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocumentClick = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        close();
      }
    };
    const onReposition = () => positionMenu();
    document.addEventListener('click', onDocumentClick);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [close, open, positionMenu]);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (!open || enabledOptions.length === 0) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, enabledOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((prev) => (prev <= 0 ? 0 : prev - 1));
      return;
    }

    if (event.key === 'Enter' && focusedIndex >= 0) {
      event.preventDefault();
      const option = enabledOptions[focusedIndex];
      if (option) {
        selectValue(option.value);
      }
    }
  };

  const renderOption = (option: DropdownSelectOption): React.ReactElement => {
    const isSelected = option.value === value;
    const isFocused =
      focusedIndex >= 0 && enabledOptions[focusedIndex]?.value === option.value;
    return (
      <button
        key={option.value}
        type="button"
        className={cn(
          'fb-select__option',
          isSelected && 'is-selected',
          isFocused && 'is-focused',
        )}
        disabled={option.disabled}
        onClick={() => selectValue(option.value)}
      >
        <span className="fb-select__option-text">{option.label}</span>
        <span className="fb-select__option-check">{CHECK_ICON}</span>
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        'fb-select',
        open && 'is-open',
        open && opensUpward && 'is-open-up',
        disabled && 'fb-select--disabled',
        className,
      )}
      data-fb-select="1"
    >
      <select
        id={selectId}
        name={name}
        className="fb-select__native"
        value={value}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => onChange(event.target.value)}
      >
        {!selected ? <option value="">{placeholder}</option> : null}
        {allOptions.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        ref={triggerRef}
        type="button"
        id={`${selectId}-trigger`}
        className="fb-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            close();
          } else {
            openMenu();
          }
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className={cn(
            'fb-select__label',
            !selected && 'fb-select__label--placeholder',
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronIcon />
      </button>

      <div
        ref={menuRef}
        className={cn('fb-select__menu', !open && 'hidden')}
        role="listbox"
        onKeyDown={onMenuKeyDown}
      >
        {groups && groups.length > 0
          ? groups.map((group) => (
              <div key={group.label || 'default-group'}>
                {group.label ? (
                  <div className="fb-select__group-label">{group.label}</div>
                ) : null}
                {group.options.map((option) => renderOption(option))}
              </div>
            ))
          : allOptions
              .filter((option) => option.value || option.label)
              .map((option) => renderOption(option))}
      </div>
    </div>
  );
}

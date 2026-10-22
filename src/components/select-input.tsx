"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { fieldClass } from "./admin-ui-classes";

export type SelectOption = {
	value: string;
	label: string;
};

type SelectInputProps = {
	"aria-label"?: string;
	"aria-labelledby"?: string;
	className?: string;
	defaultValue?: string;
	disabled?: boolean;
	id?: string;
	name: string;
	options: readonly SelectOption[];
};

export function SelectInput({
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	className,
	defaultValue,
	disabled = false,
	id,
	name,
	options,
}: SelectInputProps) {
	const generatedId = useId();
	const buttonId = id ?? generatedId;
	const listboxId = `${buttonId}-listbox`;
	const initialValue = options.find((option) => option.value === defaultValue)?.value ?? options[0]?.value ?? "";
	const [selectedValue, setSelectedValue] = useState(initialValue);
	const [activeIndex, setActiveIndex] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const selectedIndex = options.findIndex((option) => option.value === selectedValue);
	const selectedOption = options[selectedIndex] ?? options[0];
	const safeActiveIndex = Math.max(0, Math.min(activeIndex, options.length - 1));

	useEffect(() => {
		if (!isOpen) return;

		function handlePointerDown(event: PointerEvent) {
			if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
				setIsOpen(false);
			}
		}

		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [isOpen]);

	function openAtSelectedOption() {
		setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
		setIsOpen(true);
	}

	function selectOption(index: number) {
		const option = options[index];
		if (!option) return;

		setSelectedValue(option.value);
		setActiveIndex(index);
		setIsOpen(false);
		buttonRef.current?.focus();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (options.length === 0) return;

		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!isOpen) {
				openAtSelectedOption();
				return;
			}

			const offset = event.key === "ArrowDown" ? 1 : -1;
			setActiveIndex((currentIndex) => (currentIndex + offset + options.length) % options.length);
			return;
		}

		if (event.key === "Home" || event.key === "End") {
			event.preventDefault();
			setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
			setIsOpen(true);
			return;
		}

		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			if (isOpen) selectOption(safeActiveIndex);
			else openAtSelectedOption();
			return;
		}

		if (event.key === "Escape" && isOpen) {
			event.preventDefault();
			setIsOpen(false);
			setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
			return;
		}

		if (event.key === "Tab") setIsOpen(false);
	}

	return (
		<div ref={containerRef} className="relative w-full">
			<button
				ref={buttonRef}
				id={buttonId}
				type="button"
				role="combobox"
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledBy}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-controls={listboxId}
				aria-activedescendant={isOpen && options.length > 0 ? `${listboxId}-option-${safeActiveIndex}` : undefined}
				disabled={disabled}
				className={`${fieldClass} flex cursor-pointer items-center justify-between gap-3 px-3 text-left transition-colors hover:border-accent/50 ${className ?? ""}`}
				onClick={() => {
					if (isOpen) setIsOpen(false);
					else openAtSelectedOption();
				}}
				onKeyDown={handleKeyDown}
			>
				<span className="min-w-0 flex-1 truncate">{selectedOption?.label ?? ""}</span>
				<svg
					aria-hidden="true"
					className={`size-4 shrink-0 text-muted transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
				>
					<path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
				</svg>
			</button>
			<input type="hidden" name={name} value={selectedOption?.value ?? ""} disabled={disabled} />
			<div
				hidden={!isOpen}
				className="absolute left-0 top-full z-30 mt-2 w-full rounded-xl border border-line bg-surface-raised p-1.5 shadow-xl shadow-background/30"
			>
				<div
					id={listboxId}
					role="listbox"
					aria-label={ariaLabel}
					aria-labelledby={ariaLabelledBy ?? (ariaLabel ? undefined : buttonId)}
					className="max-h-60 overflow-y-auto overscroll-contain"
				>
					{options.map((option, index) => {
						const isSelected = option.value === selectedOption?.value;
						const isActive = index === safeActiveIndex;
						const optionClass = isSelected
							? "bg-accent/10 text-accent"
							: isActive
								? "bg-surface text-foreground"
								: "text-muted hover:bg-surface hover:text-foreground";

						return (
							<div
								key={option.value}
								id={`${listboxId}-option-${index}`}
								role="option"
								aria-selected={isSelected}
								className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${optionClass}`}
								onClick={() => selectOption(index)}
								onMouseMove={() => setActiveIndex(index)}
							>
								<span className="min-w-0 flex-1 truncate">{option.label}</span>
								{isSelected ? (
									<svg aria-hidden="true" className="size-4 shrink-0" fill="none" viewBox="0 0 24 24">
										<path
											d="m5 12 4 4L19 6"
											stroke="currentColor"
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
										/>
									</svg>
								) : null}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

import type React from "react";
import { useRef, useState, useCallback } from "react";
import { Icon } from "@nextticket-frontend/commons";
import { cn } from "@nextticket-frontend/commons";
import Tilt from "react-parallax-tilt";
import "./holo-card.css";

// ============================================================================
// Types
// ============================================================================

export interface HoloCardDisplayData {
	/** Event Name */
	eventName: string;
	/** Event Date/Time */
	eventDateTime?: string;
	/** Floor Name (e.g., Planta baja) */
	floorName?: string;
	/** Section Prefix (e.g., BAL-01) */
	sectionPrefix?: string;
	/** Row */
	row?: string;
	/** Seat Number */
	seat?: string;
	/** Seat Type (e.g., STANDARD) */
	seatType?: string;

	// Back data
	/** Venue Name */
	venueName?: string;
	/** Venue Address */
	venueAddress?: string;
	venueCity?: string;
	venueState?: string;
	venueCountry?: string;

	/** Ticket Folio */
	folio?: string;

	/** Background image URL */
	backgroundImage?: string;
	/** Ticket status */
	status?: "ISSUED" | "USED" | "CANCELED" | "EXPIRED";
	/** Badge/tag text (e.g., ISSUED) */
	badge?: string;
	/** Overlay color for the card */
	overlayColor?: string;
	/** Overlay opacity (0-100) */
	overlayOpacity?: number;
}


export interface HoloCardProps {
	/** Card display data */
	data: HoloCardDisplayData;
	/** Show sparkle animation effect */
	showSparkles?: boolean;
	/** Force card to show front or back (disables flip) */
	forceSide?: "front" | "back";
	/** Additional CSS classes */
	className?: string;
	/** Children rendered inside the card */
	children?: React.ReactNode;
	/** Callback when card is flipped */
	onFlip?: (isFlipped: boolean) => void;
	/** Fallback background image if data.backgroundImage is not provided */
	defaultBackground?: string;
}

// ============================================================================
// Default Values
// ============================================================================

export const HoloCard = ({
	data,
	showSparkles = true,
	forceSide,
	className,
	children,
	onFlip,
	defaultBackground = "https://www.cvent.com/sites/default/files/image/2025-06/Event%20impact.jpg",
}: HoloCardProps) => {
	const [hover, setHover] = useState(false);
	const [animated, setAnimated] = useState(true);
	const [isFlipped, setIsFlipped] = useState(false);
	const [activeBackgroundPosition, setActiveBackgroundPosition] = useState({
		tp: 0,
		lp: 0,
	});
	const ref = useRef<HTMLDivElement>(null);

	const {
		eventName,
		eventDateTime,
		floorName,
		sectionPrefix,
		row,
		seat,
		seatType,
		venueName,
		venueAddress,
		venueCity,
		venueState,
		venueCountry,
		folio,
		status,
		backgroundImage = defaultBackground,
		badge,
		overlayColor,
		overlayOpacity = 40,
	} = data;

	const handleCardClick = useCallback(() => {
		if (!forceSide) {
			const newFlippedState = !isFlipped;
			setIsFlipped(newFlippedState);
			onFlip?.(newFlippedState);
		}
	}, [forceSide, isFlipped, onFlip]);

	const handleOnMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			setAnimated(false);
			setHover(true);

			const card = ref.current;
			const l = event.nativeEvent.offsetX;
			const t = event.nativeEvent.offsetY;

			const h = card ? card.clientHeight : 0;
			const w = card ? card.clientWidth : 0;

			const px = Math.abs(Math.floor((100 / w) * l) - 100);
			const py = Math.abs(Math.floor((100 / h) * t) - 100);

			const lp = 50 + (px - 50) / 1.5;
			const tp = 50 + (py - 50) / 1.5;

			setActiveBackgroundPosition({ lp, tp });
		},
		[],
	);

	const handleOnTouchMove = useCallback(
		(event: React.TouchEvent<HTMLDivElement>) => {
			setAnimated(false);
			setHover(true);

			const card = ref.current;
			if (!card) return;

			const touch = event.touches[0];
			const rect = card.getBoundingClientRect();
			const l = touch.clientX - rect.left;
			const t = touch.clientY - rect.top;

			const h = card.clientHeight;
			const w = card.clientWidth;

			const px = Math.abs(Math.floor((100 / w) * l) - 100);
			const py = Math.abs(Math.floor((100 / h) * t) - 100);

			const lp = 50 + (px - 50) / 1.5;
			const tp = 50 + (py - 50) / 1.5;

			setActiveBackgroundPosition({ lp, tp });
		},
		[],
	);

	const handleOnMouseOut = useCallback(() => {
		setHover(false);
		setAnimated(true);
	}, []);

	const effectiveFlipped = forceSide ? forceSide === "back" : isFlipped;

	// Static mode styles for download/static rendering
	const containerStyle = forceSide
		? {
			perspective: "none",
			transform: "none",
		}
		: {
			perspective: "1000px",
			cursor: "pointer",
		};

	const innerStyle = forceSide
		? {
			transform: "none",
			position: "relative" as const,
			height: `100%`,
			width: `100%`,
		}
		: {
			transformStyle: "preserve-3d" as const,
			transform: effectiveFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
			height: `100%`,
			width: `100%`,
		};

	const frontStyle = forceSide
		? {
			display: forceSide === "front" ? "block" : "none",
			position: "absolute" as const,
			inset: 0,
		}
		: {
			position: "absolute" as const,
			inset: 0,
			backfaceVisibility: "hidden" as const,
			WebkitBackfaceVisibility: "hidden" as const,
		};

	const backStyle = forceSide
		? {
			display: forceSide === "back" ? "block" : "none",
			position: "absolute" as const,
			inset: 0,
			transform: "none",
		}
		: {
			position: "absolute" as const,
			inset: 0,
			backfaceVisibility: "hidden" as const,
			WebkitBackfaceVisibility: "hidden" as const,
			transform: "rotateY(180deg)",
		};

	const holoCardClasses = cn(
		"holo-card",
		hover && "holo-card--active",
		animated && "holo-card--animated",
		showSparkles && "holo-card--sparkles",
	);

	const holoCardStyle = {
		width: "100%",
		height: "100%",
		backgroundImage: `url(${backgroundImage})`,
		backgroundPosition: hover
			? `${activeBackgroundPosition.lp}% ${activeBackgroundPosition.tp}%`
			: "center",
		backgroundRepeat: "no-repeat",
		backgroundSize: "cover",
		borderRadius: "16px",
	} as React.CSSProperties;

	const OverlayLayer = overlayColor ? (
		<div
			className="pointer-events-none absolute inset-0 z-[3]"
			style={{
				background: overlayColor,
				mixBlendMode: "overlay",
				opacity: overlayOpacity / 100,
			}}
		/>
	) : null;

	const StatusIcon = () => {
		if (status === "ISSUED" || !status) return null;

		let IconComponent = null;
		let iconColor = "text-white";

		if (status === "USED") { IconComponent = Icon.CircleCheck; iconColor = "text-success"; }
		if (status === "CANCELED") { IconComponent = Icon.CircleSlash; iconColor = "text-danger"; }
		if (status === "EXPIRED") { IconComponent = Icon.CircleAlert; iconColor = "text-warning"; }

		if (!IconComponent) return null;

		return (
			<div className="pointer-events-none absolute inset-0 z-[50] flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-[10px]">
				<IconComponent className={cn("size-24! drop-shadow-xl", iconColor)} strokeWidth={2} />
			</div>
		);
	};



	// Front card content
	const FrontContent = (
		<div className="pointer-events-none absolute z-[2] flex h-full w-full flex-col justify-between p-5 text-white transition bg-gradient-to-b from-black/80 via-black/10 to-black/80">
			{/* Top: Event Info */}
			<div className="flex flex-col w-full">
				<div className="flex justify-between items-start w-full">
					<div className="flex flex-col gap-1">
						<span className="text-xl font-black tracking-tight uppercase leading-none drop-shadow-lg">{eventName}</span>
						<span className="text-sm font-bold text-white/90 uppercase">{venueName}</span>
						<span className="text-[10px] font-semibold tracking-widest text-white/90 uppercase drop-shadow-md">{eventDateTime}</span>
					</div>
				</div>
			</div>

			{/* Floating Badge above dashed line */}
			{badge && (
				<div className="absolute right-5 bottom-[calc(34%+24px)] rounded-full bg-black/60 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-overlay z-10">
					{badge}
				</div>
			)}

			{/* Bottom 28%: Ticket Data (Strictly below 72% line) */}
			<div className="absolute top-[66%] bottom-0 left-0 right-0 px-5 flex flex-col justify-center gap-2">
				{/* Floor & Type */}
				<div className="flex justify-between items-center w-full bg-black/40 backdrop-blur-md p-2.5 px-3 rounded-lg shadow-overlay">
					<div className="flex flex-col">
						<span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Piso</span>
						<span className="text-xs font-bold text-white/90 uppercase">{floorName || "—"}</span>
					</div>
					<div className="flex flex-col items-end">
						<span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Tipo</span>
						<span className="text-xs font-bold text-white/90 uppercase">{seatType || "—"}</span>
					</div>
				</div>

				{/* SEC / ROW / SEAT */}
				<div className="flex justify-between items-center w-full bg-black/40 backdrop-blur-md p-3 px-5 rounded-xl shadow-overlay">
					<div className="flex flex-col items-center">
						<span className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-0.5">SECCIÓN</span>
						<span className="text-2xl font-black text-white leading-none mt-1">{sectionPrefix || "—"}</span>
					</div>
					<div className="h-8 w-px bg-white/20"></div>
					<div className="flex flex-col items-center">
						<span className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-0.5">FILA</span>
						<span className="text-2xl font-black text-white leading-none mt-1">{row || "—"}</span>
					</div>
					<div className="h-8 w-px bg-white/20"></div>
					<div className="flex flex-col items-center">
						<span className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-0.5">ASIENTO</span>
						<span className="text-2xl font-black text-white leading-none mt-1">{seat || "—"}</span>
					</div>
				</div>
			</div>

			{/* Perforated Divider connecting the cutouts */}
			<div className="absolute top-[66%] left-2 right-2 border-t-2 border-dashed border-black/60 shadow-overlay" />

			{/* Painted cutouts (match background color to simulate hole) */}
			<div className="absolute top-[66%] left-0 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface z-10" />
			<div className="absolute top-[66%] right-0 translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface z-10" />
		</div>
	);

	// Back card content
	const BackContent = (
		<div className="pointer-events-none absolute z-[2] flex h-full w-full flex-col items-center p-5 text-white bg-gradient-to-t from-black/80 via-black/70 to-black/80">
			{/* Top 66%: Top Bar & QR Code */}
			<div className="absolute top-0 left-0 right-0 bottom-[34%] flex flex-col items-center p-5">
				{/* Top Bar */}
				<div className="w-full flex justify-between items-start">
					<div className="flex flex-col gap-1">
						<span className="text-xl font-black tracking-tight uppercase leading-none drop-shadow-lg">{eventName}</span>
						<span className="text-sm font-bold text-white/90 uppercase">{venueName}</span>
					</div>
				</div>

				{/* QR Code */}
				<div className="relative bg-white rounded-[10px] shadow-overlay my-auto">
					<img
						src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR3vJp2ChGnyf5NI1EcAqIEEX3EdhJUW0CKmiif3ESluQ&s=10"
						alt="QR Code"
						className="size-44 rounded-[10px] object-contain"
					/>
					<StatusIcon />
				</div>
			</div>

			{/* Bottom 34%: Folio & Venue Location Details */}
			<div className="absolute top-[66%] bottom-0 left-0 right-0 px-5 flex flex-col justify-center gap-2">
				{/* Folio Container */}
				<div className="flex justify-between items-center w-full bg-black/40 backdrop-blur-md p-2.5 px-3 rounded-lg shadow-overlay">
					<div className="flex flex-col">
						<span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Folio</span>
						<span className="text-xs font-bold text-white/90 uppercase">{folio || "TK-000000"}</span>
					</div>
				</div>

				<div className="flex flex-col items-start w-full bg-black/40 backdrop-blur-md p-2.5 px-3 rounded-lg shadow-overlay">
					<span className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Ubicación</span>
					<span className="text-sm text-white text-center leading-none mt-1">{venueAddress || "—"}</span>
					<span className="text-[9px] font-bold uppercase tracking-widest text-white/70 mt-1.5 text-center">
						{venueCity ? `${venueCity}, ${venueState}, ${venueCountry}` : "—"}
					</span>
				</div>
			</div>

			{/* Perforated Divider connecting the cutouts */}
			<div className="absolute top-[66%] left-2 right-2 border-t-2 border-dashed border-black/60 shadow-overlay" />

			{/* Painted cutouts (match background color to simulate hole) */}
			<div className="absolute top-[66%] left-0 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface z-10" />
			<div className="absolute top-[66%] right-0 translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface z-10" />
		</div>
	);

	// Render card face (either static or with tilt)
	const renderCardFace = (
		content: React.ReactNode,
		isStatic: boolean = false,
	) => {
		if (isStatic || forceSide) {
			return (
				<div className={cn(
					"relative h-full w-full overflow-hidden rounded-2xl shadow-xl",
					(status === "USED" || status === "CANCELED" || status === "EXPIRED") && "opacity-80"
				)}>
					{OverlayLayer}
					{content}
					<div ref={ref} className={cn(holoCardClasses, (status === "USED" || status === "CANCELED" || status === "EXPIRED") && "grayscale")} style={holoCardStyle}>
						{children}
					</div>
				</div>
			);
		}

		return (
			<Tilt className={cn(
				"relative h-full w-full overflow-hidden rounded-2xl p-0! shadow-xl",
				(status === "USED" || status === "CANCELED" || status === "EXPIRED") && "opacity-80"
			)}>
				{OverlayLayer}
				{content}
				<div
					ref={ref}
					className={cn(holoCardClasses, (status === "USED" || status === "CANCELED" || status === "EXPIRED") && "grayscale")}
					style={holoCardStyle}
					onMouseMove={handleOnMouseMove}
					onTouchMove={handleOnTouchMove}
					onMouseOut={handleOnMouseOut}
					onBlur={handleOnMouseOut}
				>
					{children}
				</div>
			</Tilt>
		);
	};

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				handleCardClick();
			}
		},
		[handleCardClick],
	);

	return (
		<div
			className={cn("w-full h-full", forceSide ? "" : "perspective-1000", className)}
			onClick={handleCardClick}
			onKeyDown={!forceSide ? handleKeyDown : undefined}
			role={!forceSide ? "button" : undefined}
			tabIndex={!forceSide ? 0 : undefined}
			title={
				!forceSide ? `Profile card for ${name}. Click to flip.` : undefined
			}
			style={containerStyle}
		>
			<div
				className={
					forceSide ? "relative h-full w-full" : "relative h-full w-full transition-transform duration-700"
				}
				style={innerStyle}
			>
				{/* Front Side */}
				<div style={frontStyle}>
					{renderCardFace(FrontContent, !!forceSide)}
				</div>

				{/* Back Side */}
				<div style={backStyle}>{renderCardFace(BackContent, !!forceSide)}</div>
			</div>
		</div>
	);
};

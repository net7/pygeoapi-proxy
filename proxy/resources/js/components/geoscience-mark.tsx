export default function GeoscienceMark() {
    return (
        <div className="exploration-mark" aria-hidden="true">
            <svg viewBox="0 0 160 112" fill="none" focusable="false">
                <circle cx="119" cy="24" r="16" fill="var(--brand-yellow)" />
                <path
                    d="M16 72 51 28 67 46 90 17 141 72Z"
                    fill="var(--play-sky)"
                    stroke="var(--brand-blue)"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                />
                <path d="m76 35 14-18 15 17-10-3-6 6-6-6Z" fill="var(--card)" />
                <path
                    d="M16 72c22-12 32 10 58 0s42-10 67 0v12c-25-10-42-10-67 0s-36-12-58 0Z"
                    fill="var(--brand-green)"
                    fillOpacity=".65"
                />
                <path
                    d="M16 84c22-12 32 10 58 0s42-10 67 0v11c-25-10-42-10-67 0s-36-12-58 0Z"
                    fill="var(--brand-violet)"
                    fillOpacity=".65"
                />
                <path
                    d="M16 95c22-12 32 10 58 0s42-10 67 0"
                    stroke="var(--brand-blue)"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
                <path
                    d="M28 62h19l5-9 7 20 8-29 7 18h17"
                    stroke="var(--brand-magenta)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx="29" cy="27" r="4" fill="var(--brand-violet)" />
                <path
                    d="M137 46v8m-4-4h8"
                    stroke="var(--brand-blue)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
}

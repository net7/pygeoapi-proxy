export default function AuthLandscape() {
    return (
        <svg
            className="auth-landscape"
            viewBox="0 0 480 260"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <g stroke="var(--brand-ocean)" strokeWidth="1" opacity=".16">
                <path d="M20 94c59 10 74-34 111-32s44 29 84 13 64-42 107-25 77 4 138-23" />
                <path d="M20 110c59 10 74-34 111-32s44 29 84 13 64-42 107-25 77 4 138-23" />
                <path d="M20 126c59 10 74-34 111-32s44 29 84 13 64-42 107-25 77 4 138-23" />
            </g>
            <path
                d="m20 154 76-12 56-49 41 22 47-72 57 79 44-13 59 33 60-8v58c-57 0-91 31-160 13s-117 7-168-12S64 195 20 177Z"
                fill="var(--play-sky)"
            />
            <path
                d="m152 93 41 22 47-72 57 79 44-13 59 33 60-8v30c-57 0-91 31-160 13s-117 7-168-12S64 167 20 149l76-7Z"
                fill="var(--play-mint)"
            />
            <path
                d="m193 115 47-72 57 79-36-20-22-25-19 38-13-7Z"
                fill="var(--card)"
                fillOpacity=".8"
            />
            <path
                d="M20 177c44 18 61-3 112 16s99-6 168 12 103-13 160-13v25c-57 0-91 31-160 13s-117 7-168-12S64 220 20 202Z"
                fill="var(--play-lilac)"
            />
            <path
                d="M20 163c44 18 61-3 112 16s99-6 168 12 103-13 160-13"
                stroke="var(--brand-yellow)"
                strokeWidth="5"
                strokeOpacity=".65"
            />
            <g
                stroke="var(--brand-blue)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity=".5"
            >
                <path d="m20 154 76-12 56-49 41 22 47-72 57 79 44-13 59 33 60-8" />
                <path d="M20 177c44 18 61-3 112 16s99-6 168 12 103-13 160-13" />
                <path d="M20 202c44 18 61-3 112 16s99-6 168 12 103-13 160-13" />
            </g>
            <path
                className="auth-terrain-signal"
                pathLength="1"
                d="M290 62h37l5-7 7 17 8-31 9 41 8-22 5 2h65"
                stroke="var(--brand-magenta)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity=".65"
            />
        </svg>
    );
}

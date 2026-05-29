interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const HomeIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

export const UsersIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6" />
    <path d="M17.5 14.5c2.2.5 3.5 2.3 3.5 4.5" />
  </svg>
);

export const ChatIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 5h16v11H8l-4 3.5z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </svg>
);

export const GameIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="7" width="19" height="10" rx="4" />
    <path d="M7 11v2M6 12h2" />
    <circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" />
    <circle cx="17.5" cy="13.5" r="0.6" fill="currentColor" />
  </svg>
);

export const LogoutIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="M10 12H3M6 8l-4 4 4 4" />
  </svg>
);

export const PhoneIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);

export const VideoIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="6" width="12" height="12" rx="2.5" />
    <path d="M15 10.5 21 7v10l-6-3.5z" />
  </svg>
);

export const MicIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const MicOffIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 9v-3a3 3 0 0 1 6 0v5" />
    <path d="M5 11a7 7 0 0 0 11 5.5M12 18v3" />
    <path d="M3 3l18 18" />
  </svg>
);

export const CamOffIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M15 11.5V8a2 2 0 0 0-2-2H6.5" />
    <path d="M3 8v8a2 2 0 0 0 2 2h8l2-2" />
    <path d="M21 7l-6 3.5" />
    <path d="M3 3l18 18" />
  </svg>
);

export const ChannelIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
    <circle cx="5" cy="19" r="1.4" fill="currentColor" />
  </svg>
);

export const HangupIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 9c5-3 13-3 18 0l-2 3-4-1v-2c-2-.6-4-.6-6 0v2l-4 1z" transform="rotate(135 12 11)" />
  </svg>
);

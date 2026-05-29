import { fileUrl } from "@/lib/api";

interface AvatarProps {
  url: string | null;
  name: string;
  size?: number;
}

export function Avatar({ url, name, size = 40 }: AvatarProps) {
  const resolved = fileUrl(url);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: resolved ? "transparent" : "linear-gradient(135deg, #6d8cff, #5675f0)",
        fontSize: size * 0.4,
      }}
    >
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolved} alt={name} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

import { fileUrl } from "@/lib/api";

interface ChannelAvatarProps {
  imageUrl: string | null;
  name: string;
  size?: number;
  rounded?: string;
}

/** Аватарка канала: картинка либо градиент с первой буквой названия. */
export function ChannelAvatar({ imageUrl, name, size = 48, rounded = "rounded-xl" }: ChannelAvatarProps) {
  const resolved = fileUrl(imageUrl);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden font-bold text-white ${rounded}`}
      style={{
        width: size,
        height: size,
        background: resolved ? "transparent" : "linear-gradient(135deg, #6d8cff, #5675f0)",
        fontSize: size * 0.42,
      }}
    >
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolved} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

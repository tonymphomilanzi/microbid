const DEFAULT_AVATAR = "/avatar-default.png";

export default function UserAvatar({ src, alt = "User", size = 36, className = "" }) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted/20 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={src || DEFAULT_AVATAR}
        alt={alt}
        className="h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.src = DEFAULT_AVATAR;
        }}
      />
    </div>
  );
}
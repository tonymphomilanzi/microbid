const DEFAULT_AVATAR = "/avatar-default.png";

export default function UserAvatar({
  src,
  alt = "User",
  size = 36,
  online,            // boolean
  showStatus = true, // 
  className = "",
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted/20 ${className}`}
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

      {showStatus ? (
        <span
          className={[
            "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background",
            online ? "bg-emerald-500" : "bg-zinc-400/70",
          ].join(" ")}
          title={online ? "Online" : "Offline"}
        />
      ) : null}
    </div>
  );
}
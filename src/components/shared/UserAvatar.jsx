const DEFAULT_AVATAR = "/avatar-default.png";

export default function UserAvatar({
  src,
  alt = "User",
  size = 36,
  online,
  showStatus = true,
  className = "",
}) {
  return (
    <div
      className={`relative shrink-0 overflow-visible ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Avatar circle */}
      <div className="h-full w-full overflow-hidden rounded-full border border-border/60 bg-muted/20">
        <img
          src={src || DEFAULT_AVATAR}
          alt={alt}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_AVATAR;
          }}
        />
      </div>

      {/* Status dot (outside) */}
      {showStatus ? (
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background shadow-sm",
            online ? "bg-emerald-600" : "bg-zinc-500/50",
          ].join(" ")}
          title={online ? "Online" : "Offline"}
        />
      ) : null}
    </div>
  );
}